/* WebSocket connection with auto-reconnect and status management. */

"use strict";

const ChatSocket = (function () {
    let socket = null;
    let username = null;
    let manuallyClosed = false;
    let handlers = {};
    let reconnectAttempts = 0;
    let reconnectTimer = null;

    const MAX_DELAY = 5;

    function wsUrl() {
        const proto = location.protocol === "https:" ? "wss://" : "ws://";
        return proto + location.host + "/ws";
    }

    function setStatus(state) {
        const el = document.getElementById("conn-status");
        if (!el) return;
        el.className = "conn-status";
        if (state === "connected") {
            el.textContent = "● Connected";
            el.classList.add("conn-connected");
        } else if (state === "connecting") {
            el.textContent = "◌ Connecting";
            el.classList.add("conn-connecting");
        } else {
            el.textContent = "○ Disconnected";
            el.classList.add("conn-disconnected");
        }
        if (typeof handlers.onStatus === "function") handlers.onStatus(state);
    }

    function connect() {
        if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
            return;
        }
        setStatus("connecting");
        socket = new WebSocket(wsUrl());

        socket.onopen = function () {
            reconnectAttempts = 0;
            setStatus("connected");
            if (username) {
                send({ type: "user_join", username: username });
            }
        };

        socket.onmessage = function (event) {
            let data;
            try {
                data = JSON.parse(event.data);
            } catch (e) {
                return;
            }
            if (typeof handlers.onMessage === "function") handlers.onMessage(data);
        };

        socket.onclose = function () {
            setUsernameLocal();
            if (manuallyClosed) return;
            setStatus("disconnected");
            if (typeof handlers.onDisconnect === "function") handlers.onDisconnect();
            scheduleReconnect();
        };

        socket.onerror = function () {
            /* onclose will handle reconnect */
        };
    }

    function scheduleReconnect() {
        if (reconnectTimer) clearTimeout(reconnectTimer);
        const delay = Math.min(reconnectAttempts + 1, MAX_DELAY) * 1000;
        reconnectAttempts += 1;
        reconnectTimer = setTimeout(function () {
            if (typeof handlers.onReconnectAttempt === "function") handlers.onReconnectAttempt();
            connect();
        }, delay);
    }

    function send(data) {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify(data));
            return true;
        }
        return false;
    }

    function setUsername(newUsername) {
        username = newUsername;
    }

    function setUsernameLocal() {
        /* placeholder hook if needed */
    }

    function getUsername() {
        return username;
    }

    function close() {
        manuallyClosed = true;
        if (reconnectTimer) clearTimeout(reconnectTimer);
        if (socket) socket.close();
    }

    function openNew(usr) {
        manuallyClosed = false;
        reconnectAttempts = 0;
        username = usr;
        connect();
    }

    return {
        connect: connect,
        openNew: openNew,
        send: send,
        close: close,
        setUsername: setUsername,
        getUsername: getUsername,
        setHandler: function (name, fn) { handlers[name] = fn; },
    };
})();
