// script.js - jQuery version with IndexedDB storage and image upload functionality
$(document).ready(function () {
    // Initialize IndexedDB
    let db;
    const DB_NAME = 'CardsApp';
    const DB_VERSION = 1;
    let currentUser = null;

    const adminData = {
        username: "admin@mail.ru",
        password: "admin"
    };

    // Open database connection
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = function (event) {
        console.error("Database error: " + event.target.errorCode);
    };

    request.onupgradeneeded = function (event) {
        db = event.target.result;

        // Create object stores if they don't exist
        if (!db.objectStoreNames.contains('users')) {
            db.createObjectStore('users', { keyPath: 'username' });
        }

        if (!db.objectStoreNames.contains('cards')) {
            const cardsStore = db.createObjectStore('cards', { keyPath: 'id', autoIncrement: true });
            cardsStore.createIndex('status', 'status', { unique: false });
        }

        if (!db.objectStoreNames.contains('currentUser')) {
            db.createObjectStore('currentUser', { keyPath: 'id' });
        }
    };

    request.onsuccess = function (event) {
        db = event.target.result;
        console.log("Database opened successfully");

        // Check authentication after DB is ready
        checkAuth();

        // Display cards if on cards page
        if (window.location.pathname.includes('cards.html')) {
            displayCards();
        }
    };

    // Register user function
    $('#register-form').on('submit', function (event) {
        event.preventDefault();

        const username = $('#register-username').val();
        const password = $('#register-password').val();

        if (!username || !password) {
            alert('Заполните все поля');
            return;
        }

        const transaction = db.transaction(['users'], 'readwrite');
        const userStore = transaction.objectStore('users');

        const user = { username, password };
        const request = userStore.add(user);

        request.onsuccess = function () {
            alert('Регистрация прошла успешно! Вы можете войти в свой акаунт.');
            window.location.href = 'login.html';
        };

        request.onerror = function () {
            alert('Ошибка при регистрации. Возможно, такой пользователь уже существует.');
        };
    });

    // Login user function
    $('#login-form').on('submit', function (event) {
        event.preventDefault();

        const username = $('#login-username').val();
        const password = $('#login-password').val();

        if (!username || !password) {
            alert('Заполните все поля.');
            return;
        }

        // Admin check
        if (username === adminData.username && password === adminData.password) {
            setCurrentUser({ username: 'admin', isAdmin: true });
            return;
        }

        // User check
        const transaction = db.transaction(['users'], 'readonly');
        const userStore = transaction.objectStore('users');
        const request = userStore.get(username);

        request.onsuccess = function (event) {
            const user = event.target.result;
            if (user && password === user.password) {
                setCurrentUser({ username: user.username, isAdmin: false });
            } else {
                alert('Такого пользователя не существует. Введите корректные данные.');
            }
        };

        request.onerror = function () {
            alert('Ошибка при входе в систему.');
        };
    });

    // Set current user function
    function setCurrentUser(user) {
        const transaction = db.transaction(['currentUser'], 'readwrite');
        const userStore = transaction.objectStore('currentUser');

        // Clear existing data
        const clearRequest = userStore.clear();

        clearRequest.onsuccess = function () {
            // Add new user data
            const addRequest = userStore.add({ id: 1, ...user });

            addRequest.onsuccess = function () {
                window.location.href = 'cards.html';
            };
        };
    }

    // Logout function
    $(document).on('click', '.logout-btn', function () {
        const transaction = db.transaction(['currentUser'], 'readwrite');
        const userStore = transaction.objectStore('currentUser');

        const request = userStore.clear();

        request.onsuccess = function () {
            console.log('Logout successful');
            window.location.href = 'index.html';
        };
    });

    // Toggle dropdown function
    $('.profile-btn').on('click', function () {
        $('#profile-dropdown').toggleClass('show');
    });

    // Image preview function
    $('#card-image').on('change', function () {
        const file = this.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (e) {
                $('#image-preview').attr('src', e.target.result);
                $('#image-preview-container').show();
            }
            reader.readAsDataURL(file);
        }
    });

    // Create card function with image
    $('#create-form').on('submit', function (event) {
        event.preventDefault();

        const title = $('#card-title').val();
        const description = $('#card-description').val();
        const imageInput = $('#card-image')[0];
        let imageData = '';

        if (!title || !description) {
            alert('Заполните все поля');
            return;
        }

        // Process image if exists
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

    // Function to save card data
    function saveCard(title, description, imageData) {
        const transaction = db.transaction(['cards'], 'readwrite');
        const cardsStore = transaction.objectStore('cards');

        const newCard = {
            title,
            description,
            status: "новое",
            image: imageData,
            createdAt: new Date()
        };

        const request = cardsStore.add(newCard);

        request.onsuccess = function () {
            alert('Успешно!');
            window.location.href = 'cards.html';
        };

        request.onerror = function () {
            alert('Ошибка при сохранении карточки.');
        };
    }

    // Display cards function
    function displayCards() {
        // Check if user is logged in
        getCurrentUser(function (currentUser) {
            if (!currentUser) {
                window.location.href = 'index.html';
                return;
            }

            // Set username in header
            $('#username').text(currentUser.username);

            // Clear container
            $('#cards-container').empty();

            const transaction = db.transaction(['cards'], 'readonly');
            const cardsStore = transaction.objectStore('cards');
            const request = cardsStore.getAll();

            request.onsuccess = function (event) {
                const cards = event.target.result;

                // Display cards
                if (cards.length === 0) {
                    $('#cards-container').html('<p>Нет карточек. Создайте</p>');
                } else {
                    $.each(cards, function (index, card) {
                        const cardElement = $('<div>').addClass('card');

                        // Create card content
                        let cardContent = `
                            <h3>${card.title}</h3>
                            <p>${card.description}</p>
                            <p>Статус: ${card.status}</p>
                        `;

                        // Add image if exists
                        if (card.image && card.image !== '') {
                            cardContent += `<div class="card-image-container">
                                <img src="${card.image}" alt="Card image" class="card-image">
                            </div>`;
                        }

                        cardElement.html(cardContent);

                        if (currentUser.username === 'admin') {
                            // Delete button
                            const deleteButton = $('<button>')
                                .text('Удалить')
                                .addClass('delete-button')
                                .data('id', card.id)
                                .on('click', function () {
                                    deleteCard($(this).data('id'));
                                });
                            cardElement.append(deleteButton);

                            // Status select
                            const statusSelect = $('<select>')
                                .addClass('status-select')
                                .data('id', card.id);

                            const statuses = ['новое', 'подтверждено', 'отклонено'];
                            $.each(statuses, function (i, status) {
                                const option = $('<option>')
                                    .val(status)
                                    .text(status);
                                if (status === card.status) {
                                    option.prop('selected', true);
                                }
                                statusSelect.append(option);
                            });

                            statusSelect.on('change', function () {
                                changeStatus($(this).data('id'), $(this).val());
                            });
                            cardElement.append(statusSelect);
                        }

                        $('#cards-container').append(cardElement);
                    });
                }
            };

            request.onerror = function () {
                console.error("Error fetching cards");
            };
        });
    }

    // Change card status function
    function changeStatus(id, newStatus) {
        const transaction = db.transaction(['cards'], 'readwrite');
        const cardsStore = transaction.objectStore('cards');

        const request = cardsStore.get(id);

        request.onsuccess = function (event) {
            const card = event.target.result;
            card.status = newStatus;

            const updateRequest = cardsStore.put(card);

            updateRequest.onsuccess = function () {
                displayCards();
            };
        };
    }

    // Delete card function
    function deleteCard(id) {
        const transaction = db.transaction(['cards'], 'readwrite');
        const cardsStore = transaction.objectStore('cards');

        const request = cardsStore.delete(id);

        request.onsuccess = function () {
            displayCards();
        };
    }

    // Get current user function
    function getCurrentUser(callback) {
        const transaction = db.transaction(['currentUser'], 'readonly');
        const userStore = transaction.objectStore('currentUser');

        const request = userStore.get(1);

        request.onsuccess = function (event) {
            callback(event.target.result);
        };

        request.onerror = function () {
            callback(null);
        };
    }

    // Check authentication
    function checkAuth() {
        const protectedPages = ['cards.html', 'create.html'];
        const currentPage = window.location.pathname.split('/').pop();

        if (protectedPages.includes(currentPage)) {
            getCurrentUser(function (user) {
                if (!user) {
                    window.location.href = 'login.html';
                }
            });
        }
    }

    // Close dropdown when clicking outside
    $(document).on('click', function (e) {
        if (!$(e.target).hasClass('profile-btn')) {
            if ($('#profile-dropdown').hasClass('show')) {
                $('#profile-dropdown').removeClass('show');
            }
        }
    });
});