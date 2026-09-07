/* Login page logic. */

"use strict";

(function () {
    const form = document.getElementById("login-form");
    const input = document.getElementById("username");
    const errorBox = document.getElementById("login-error");

    function showError(msg) {
        errorBox.textContent = msg;
        errorBox.hidden = false;
    }

    form.addEventListener("submit", function (event) {
        event.preventDefault();
        const name = (input.value || "").trim();

        if (!name) {
            showError("Username tidak boleh kosong.");
            return;
        }
        if (/^\s*$/.test(name)) {
            showError("Username tidak boleh hanya berisi spasi.");
            return;
        }
        if (name.length > 30) {
            showError("Username maksimal 30 karakter.");
            return;
        }

        errorBox.hidden = true;
        sessionStorage.setItem("localroom_user", name);
        window.location.href = "/chat?u=" + encodeURIComponent(name);
    });
})();
