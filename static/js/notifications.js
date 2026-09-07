/* Browser Notification API wrapper (graceful fallback). */

"use strict";

const Notifier = (function () {
    let supported = "Notification" in window;
    let granted = false;

    function requestPermission() {
        if (!supported) return;
        if (Notification.permission === "granted") {
            granted = true;
        } else if (Notification.permission === "default") {
            Notification.requestPermission().then(function (perm) {
                granted = perm === "granted";
            });
        }
    }

    function notify(title, body) {
        if (supported && Notification.permission === "granted") {
            try {
                new Notification(title, { body: body });
            } catch (e) {
                /* ignore */
            }
        }
    }

    return {
        requestPermission: requestPermission,
        notify: notify,
    };
})();
