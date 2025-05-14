// scripts/script.js
$(document).ready(function () {
	// Инициализация IndexedDB
	let db;
	const DB_NAME = "CardsApp";
	const DB_VERSION = 1;

	const adminData = {
		username: "admin@mail.ru",
		password: "admin",
	};

	// Открываем базу данных
	const request = indexedDB.open(DB_NAME, DB_VERSION);

	request.onerror = function (event) {
		console.error("Database error: " + event.target.errorCode);
	};

	request.onupgradeneeded = function (event) {
		db = event.target.result;
		if (!db.objectStoreNames.contains("users")) {
			db.createObjectStore("users", { keyPath: "username" });
		}
		if (!db.objectStoreNames.contains("cards")) {
			const cardsStore = db.createObjectStore("cards", {
				keyPath: "id",
				autoIncrement: true,
			});
			cardsStore.createIndex("status", "status", { unique: false });
		}
		if (!db.objectStoreNames.contains("currentUser")) {
			db.createObjectStore("currentUser", { keyPath: "id" });
		}
	};

	request.onsuccess = function (event) {
		db = event.target.result;
		// Проверка авторизации
		checkAuth();

		// Если мы на странице карточек — показать карточки
		if (window.location.pathname.includes("/cards/")) {
			displayCards();
		}
	};

	// Регистрация пользователя
	$("#register-form").on("submit", function (event) {
		event.preventDefault();
		const username = $("#register-username").val();
		const password = $("#register-password").val();

		if (!username || !password) {
			alert("Заполните все поля");
			return;
		}

		const transaction = db.transaction(["users"], "readwrite");
		const userStore = transaction.objectStore("users");

		const user = { username, password };
		const request = userStore.add(user);

		request.onsuccess = function () {
			alert("Регистрация прошла успешно! Вы можете войти в свой акаунт.");
			window.location.href = "../login/";
		};

		request.onerror = function () {
			alert(
				"Ошибка при регистрации. Возможно, такой пользователь уже существует.",
			);
		};
	});

	// Вход пользователя
	$("#login-form").on("submit", function (event) {
		event.preventDefault();

		const username = $("#login-username").val();
		const password = $("#login-password").val();

		if (!username || !password) {
			alert("Заполните все поля.");
			return;
		}

		// Проверка администратора
		if (
			username === adminData.username &&
			password === adminData.password
		) {
			setCurrentUser({ username: "admin", isAdmin: true });
			return;
		}

		// Проверка пользователя
		const transaction = db.transaction(["users"], "readonly");
		const userStore = transaction.objectStore("users");
		const request = userStore.get(username);

		request.onsuccess = function (event) {
			const user = event.target.result;
			if (user && password === user.password) {
				setCurrentUser({ username: user.username, isAdmin: false });
			} else {
				alert(
					"Такого пользователя не существует. Введите корректные данные.",
				);
			}
		};

		request.onerror = function () {
			alert("Ошибка при входе в систему.");
		};
	});

	// Устанавливаем текущего пользователя
	function setCurrentUser(user) {
		const transaction = db.transaction(["currentUser"], "readwrite");
		const userStore = transaction.objectStore("currentUser");
		const clearRequest = userStore.clear();
		clearRequest.onsuccess = function () {
			userStore.add({ id: 1, ...user }).onsuccess = function () {
				window.location.href = "../cards/";
			};
		};
	}

	// Выход
	$(document).on("click", ".logout-btn", function () {
		const transaction = db.transaction(["currentUser"], "readwrite");
		const userStore = transaction.objectStore("currentUser");
		userStore.clear().onsuccess = function () {
			// Определяем уровень вложенности и корректно редиректим
			if (window.location.pathname.split("/").length > 2) {
				window.location.href = "../";
			} else {
				window.location.href = "./";
			}
		};
	});

	// Выпадающее меню профиля
	$(".profile-btn").on("click", function () {
		$("#profile-dropdown").toggleClass("show");
	});

	// Превью изображения
	$("#card-image").on("change", function () {
		const file = this.files[0];
		if (file) {
			const reader = new FileReader();
			reader.onload = function (e) {
				$("#image-preview").attr("src", e.target.result);
				$("#image-preview-container").show();
			};
			reader.readAsDataURL(file);
		}
	});

	// Создание карточки
	$("#create-form").on("submit", function (event) {
		event.preventDefault();
		const title = $("#card-title").val();
		const description = $("#card-description").val();
		const imageInput = $("#card-image")[0];
		let imageData = "";

		if (!title || !description) {
			alert("Заполните все поля");
			return;
		}

		if (imageInput && imageInput.files[0]) {
			const reader = new FileReader();
			reader.onloadend = function () {
				imageData = reader.result;
				saveCard(title, description, imageData);
			};
			reader.readAsDataURL(imageInput.files[0]);
		} else {
			saveCard(title, description, imageData);
		}
	});

	function saveCard(title, description, imageData) {
		const transaction = db.transaction(["cards"], "readwrite");
		const cardsStore = transaction.objectStore("cards");
		const newCard = {
			title,
			description,
			status: "новое",
			image: imageData,
			createdAt: new Date(),
		};
		cardsStore.add(newCard).onsuccess = function () {
			alert("Успешно!");
			window.location.href = "../cards/";
		};
	}

	// Отображение карточек
	function displayCards() {
		getCurrentUser(function (currentUser) {
			if (!currentUser) {
				window.location.href = "../login/";
				return;
			}
			$("#username").text(currentUser.username);
			$("#cards-container").empty();

			const transaction = db.transaction(["cards"], "readonly");
			const cardsStore = transaction.objectStore("cards");
			cardsStore.getAll().onsuccess = function (event) {
				const cards = event.target.result;
				if (cards.length === 0) {
					$("#cards-container").html("<p>Нет карточек. Создайте</p>");
				} else {
					$.each(cards, function (index, card) {
						const cardElement = $("<div>").addClass("card");
						let cardContent = `
                            <h3>${card.title}</h3>
                            <p>${card.description}</p>
                            <p>Статус: ${card.status}</p>
                        `;
						if (card.image && card.image !== "") {
							cardContent += `<div class="card-image-container">
                                <img src="${card.image}" alt="Card image" class="card-image">
                            </div>`;
						}
						cardElement.html(cardContent);

						if (currentUser.username === "admin") {
							// Кнопка удаления
							const deleteButton = $("<button>")
								.text("Удалить")
								.addClass("delete-button")
								.data("id", card.id)
								.on("click", function () {
									deleteCard($(this).data("id"));
								});
							cardElement.append(deleteButton);

							// Селектор статуса
							const statusSelect = $("<select>")
								.addClass("status-select")
								.data("id", card.id);
							const statuses = [
								"новое",
								"подтверждено",
								"отклонено",
							];
							$.each(statuses, function (i, status) {
								const option = $("<option>")
									.val(status)
									.text(status);
								if (status === card.status)
									option.prop("selected", true);
								statusSelect.append(option);
							});
							statusSelect.on("change", function () {
								changeStatus($(this).data("id"), $(this).val());
							});
							cardElement.append(statusSelect);
						}
						$("#cards-container").append(cardElement);
					});
				}
			};
		});
	}

	function changeStatus(id, newStatus) {
		const transaction = db.transaction(["cards"], "readwrite");
		const cardsStore = transaction.objectStore("cards");
		cardsStore.get(id).onsuccess = function (event) {
			const card = event.target.result;
			card.status = newStatus;
			cardsStore.put(card).onsuccess = function () {
				displayCards();
			};
		};
	}

	function deleteCard(id) {
		const transaction = db.transaction(["cards"], "readwrite");
		const cardsStore = transaction.objectStore("cards");
		cardsStore.delete(id).onsuccess = function () {
			displayCards();
		};
	}

	function getCurrentUser(callback) {
		const transaction = db.transaction(["currentUser"], "readonly");
		const userStore = transaction.objectStore("currentUser");
		userStore.get(1).onsuccess = function (event) {
			callback(event.target.result);
		};
		userStore.get(1).onerror = function () {
			callback(null);
		};
	}

	// Проверка защищённых страниц
	function checkAuth() {
		// cards/, create/ — защищённые папки
		const path = window.location.pathname;
		const protectedPages = ["/cards/", "/create/"];
		if (protectedPages.some((page) => path.endsWith(page))) {
			getCurrentUser(function (user) {
				if (!user) {
					window.location.href = "../login/";
				}
			});
		}
	}

	// Закрыть выпадающий профиль при клике вне
	$(document).on("click", function (e) {
		if (!$(e.target).hasClass("profile-btn")) {
			if ($("#profile-dropdown").hasClass("show")) {
				$("#profile-dropdown").removeClass("show");
			}
		}
	});
});
