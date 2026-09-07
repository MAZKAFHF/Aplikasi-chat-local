/* Main chat logic. */

"use strict";

(function () {
    const BASE_TITLE = "LocalRoom Chat";

    const messagesEl = document.getElementById("chat-messages");
    const emptyState = document.getElementById("empty-state");
    const userListEl = document.getElementById("user-list");
    const onlineCountEl = document.getElementById("online-count");
    const currentUserEl = document.getElementById("current-user");
    const composer = document.getElementById("composer");
    const inputEl = document.getElementById("message-input");
    const sendBtn = document.getElementById("send-btn");
    const fileInput = document.getElementById("file-input");
    const uploadStatus = document.getElementById("upload-status");
    const leaveBtn = document.getElementById("leave-btn");
    const sidebar = document.getElementById("sidebar");
    const sidebarToggle = document.getElementById("sidebar-toggle");
    const lightbox = document.getElementById("lightbox");
    const lightboxImg = document.getElementById("lightbox-img");
    const lightboxClose = document.getElementById("lightbox-close");

    let myUsername = "";
    let unread = 0;
    let isNearBottom = true;
    let welcomeArrived = false;

    let unreadBanner = null;

    function currentUsername() {
        if (myUsername) return myUsername;
        const param = new URLSearchParams(location.search).get("u");
        const stored = sessionStorage.getItem("localroom_user");
        myUsername = (param || stored || "").trim();
        return myUsername;
    }

    function redirectToLogin() {
        sessionStorage.removeItem("localroom_user");
        window.location.href = "/";
    }

    // --- rendering helpers -------------------------------------------------

    function emptyStateVisibility() {
        const hasChildren = messagesEl.children.length > 0;
        emptyState.hidden = hasChildren;
    }

    function renderMessage(msg, prepend) {
        const el = document.createElement("div");
        const isMine = msg.sender === myUsername;
        el.className = "msg " + (isMine ? "me" : "other");

        if (msg.type === "text") {
            el.innerHTML = buildText(msg);
        } else if (msg.type === "image") {
            el.innerHTML = buildImage(msg);
        } else if (msg.type === "file") {
            el.innerHTML = buildFile(msg);
        } else {
            return;
        }

        if (prepend) {
            messagesEl.prepend(el);
        } else {
            messagesEl.appendChild(el);
        }
        emptyStateVisibility();
        return el;
    }

    function buildText(msg) {
        return (
            '<div class="msg-meta"><span class="msg-sender">' + escapeHtml(msg.sender) +
            '</span><span class="msg-time">' + formatTime(msg.timestamp) + "</span></div>" +
            '<div class="bubble">' + linkify(escapeHtml(msg.content)) + "</div>"
        );
    }

    function buildImage(msg) {
        const url = escapeHtml(msg.image.url);
        return (
            '<div class="msg-meta"><span class="msg-sender">' + escapeHtml(msg.sender) +
            '</span><span class="msg-time">' + formatTime(msg.timestamp) + "</span></div>" +
            '<img class="msg-image" src="' + url + '" alt="Gambar" data-full="' + url + '">'
        );
    }

    function buildFile(msg) {
        const f = msg.file;
        const url = escapeHtml(f.url);
        const name = escapeHtml(f.original_name);
        return (
            '<div class="msg-meta"><span class="msg-sender">' + escapeHtml(msg.sender) +
            '</span><span class="msg-time">' + formatTime(msg.timestamp) + "</span></div>" +
            '<div class="file-card">' +
            '<span class="file-icon">' + iconForName(f.original_name) + "</span>" +
            '<div class="file-info"><div class="file-name">' + name +
            '</div><div class="file-size">' + formatSize(f.size) + " · " + escapeHtml(msg.sender) + "</div></div>" +
            '<a class="download-btn" href="' + url + '" download>Download</a>' +
            "</div>"
        );
    }

    function renderUsers(users) {
        userListEl.innerHTML = "";
        const shown = new Set();
        users.forEach(function (u) {
            if (shown.has(u.username)) return;
            shown.add(u.username);
            const li = document.createElement("li");
            const isMe = u.username === myUsername;
            li.innerHTML =
                '<span class="dot"></span><span>' + escapeHtml(u.username) + (isMe ? " (Anda)" : "") + "</span>";
            if (isMe) li.classList.add("me");
            userListEl.appendChild(li);
        });
        if (currentUsername() && !shown.has(currentUsername())) {
            shown.add(currentUsername());
            const li = document.createElement("li");
            li.innerHTML = '<span class="dot"></span><span>' + escapeHtml(currentUsername()) + " (Anda)</span>";
            li.classList.add("me");
            userListEl.appendChild(li);
        }
        onlineCountEl.textContent = "Online: " + shown.size;
    }

    // --- notifications -----------------------------------------------------

    function onScroll() {
        const threshold = 80;
        const dist = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight;
        isNearBottom = dist < threshold;
        if (isNearBottom) {
            clearUnread(false);
        }
    }

    function clearUnread(updateTitle) {
        unread = 0;
        if (unreadBanner) { unreadBanner.remove(); unreadBanner = null; }
        if (updateTitle !== false) document.title = BASE_TITLE;
    }

    function markUnread(sender, preview) {
        unread += 1;
        document.title = "(" + unread + ") " + BASE_TITLE;
        if (typeof Notifier !== "undefined") {
            Notifier.notify(sender, preview);
        }
        if (!isNearBottom) {
            if (!unreadBanner) {
                unreadBanner = document.createElement("button");
                unreadBanner.className = "unread-banner";
                unreadBanner.textContent = "Pesan baru ↓";
                unreadBanner.addEventListener("click", scrollToBottom);
                document.body.appendChild(unreadBanner);
            }
        }
    }

    function scrollToBottom() {
        messagesEl.scrollTop = messagesEl.scrollHeight;
        clearUnread(true);
    }

    // --- messaging ---------------------------------------------------------

    function sendMessage() {
        const text = inputEl.value;
        if (!text.trim()) return;
        const ok = ChatSocket.send({ type: "chat_message", content: text });
        if (!ok) {
            showUploadStatus("Koneksi terputus. Menunggu reconnect...", true);
            return;
        }
        inputEl.value = "";
        inputEl.style.height = "auto";
    }

    // --- upload ------------------------------------------------------------

    async function handleFile(file) {
        if (!file) return;
        if (file.size > 100 * 1024 * 1024) {
            showUploadStatus("Ukuran file melebihi batas maksimum (100 MB).", true);
            return;
        }
        showUploadStatus("Mengunggah " + file.name + "...", false);

        const formData = new FormData();
        formData.append("file", file);

        try {
            const resp = await fetch("/api/upload", { method: "POST", body: formData });
            const data = await resp.json();
            if (!resp.ok || !data.success) {
                showUploadStatus((data && data.detail) || "Upload gagal. Silakan coba lagi.", true);
                return;
            }
            hideUploadStatus();
            ChatSocket.send({ type: "file_message", file: data.file });
        } catch (e) {
            showUploadStatus("Upload gagal. Silakan coba lagi.", true);
        }
    }

    function showUploadStatus(text, isError) {
        uploadStatus.textContent = text;
        uploadStatus.style.color = isError ? "#f87171" : "";
        uploadStatus.hidden = false;
    }

    function hideUploadStatus() {
        uploadStatus.hidden = true;
    }

    // --- websocket handlers -------------------------------------------------

    function handleIncoming(data) {
        switch (data.type) {
            case "welcome":
                welcomeArrived = true;
                myUsername = data.username;
                currentUserEl.textContent = myUsername;
                hideUploadStatus();
                // restore history
                (data.messages || []).forEach(function (m) { renderMessage(m); });
                renderUsers(data.users || []);
                scrollToBottom();
                break;

            case "message_created": {
                const m = data.message;
                renderMessage(m);
                if (m.sender !== myUsername && !isNearBottom) {
                    markUnread(m.sender, previewOf(m));
                }
                if (isNearBottom) scrollToBottom();
                break;
            }

            case "users_updated":
                renderUsers(data.users || []);
                break;

            case "error":
                showUploadStatus(data.message, true);
                if (!welcomeArrived) {
                    setTimeout(redirectToLogin, 800);
                }
                break;

            case "ping":
                break;

            case "pong":
                break;
        }
    }

    function previewOf(m) {
        if (m.type === "text") return m.content.slice(0, 60);
        if (m.type === "image") return "📷 Mengirim gambar";
        if (m.type === "file") return "📄 " + m.file.original_name;
        return "";
    }

    // --- setup -------------------------------------------------------------

    function init() {
        const name = currentUsername();
        if (!name) {
            redirectToLogin();
            return;
        }
        currentUserEl.textContent = name;

        ChatSocket.setUsername(name);
        ChatSocket.setHandler("onMessage", handleIncoming);
        ChatSocket.setHandler("onStatus", function () {});
        ChatSocket.setHandler("onDisconnect", function () {
            showUploadStatus("\u26a0 Koneksi terputus. Mencoba menyambungkan kembali...", true);
        });
        ChatSocket.setHandler("onReconnectAttempt", function () {
            showUploadStatus("Belum dapat terhubung kembali ke server.", true);
        });

        ChatSocket.openNew(name);
        if (typeof Notifier !== "undefined") {
            Notifier.requestPermission();
            setTimeout(function () {
                const p = document.getElementById("permission-hint");
                if (p) p.remove();
            }, 0);
        }

        composer.addEventListener("submit", function (e) {
            e.preventDefault();
            sendMessage();
        });

        inputEl.addEventListener("input", function () {
            inputEl.style.height = "auto";
            inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + "px";
        });

        inputEl.addEventListener("keydown", function (e) {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        fileInput.addEventListener("change", function () {
            if (fileInput.files && fileInput.files[0]) {
                handleFile(fileInput.files[0]);
            }
            fileInput.value = "";
        });

        messagesEl.addEventListener("scroll", onScroll);
        onScroll();

        messagesEl.addEventListener("click", function (e) {
            const img = e.target.closest(".msg-image");
            if (img) {
                lightboxImg.src = img.dataset.full;
                lightbox.hidden = false;
            }
        });

        lightboxClose.addEventListener("click", function () {
            lightbox.hidden = true;
            lightboxImg.src = "";
        });
        lightbox.addEventListener("click", function (e) {
            if (e.target === lightbox) {
                lightbox.hidden = true;
                lightboxImg.src = "";
            }
        });

        leaveBtn.addEventListener("click", function () {
            ChatSocket.close();
            redirectToLogin();
        });

        sidebarToggle.addEventListener("click", function () {
            sidebar.classList.toggle("open");
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
