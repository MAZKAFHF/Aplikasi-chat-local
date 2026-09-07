/* Shared helpers for LocalRoom Chat. */

"use strict";

function escapeHtml(value) {
    const div = document.createElement("div");
    div.textContent = String(value == null ? "" : value);
    return div.innerHTML;
}

function formatTime(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d)) return "";
    return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

function formatSize(bytes) {
    if (bytes == null) return "";
    if (bytes === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const val = bytes / Math.pow(1024, i);
    return val.toFixed(val >= 10 || i === 0 ? 0 : 1) + " " + units[i];
}

const URL_REGEX = /(https?:\/\/[^\s<]+)/g;

function linkify(text) {
    return String(text).replace(URL_REGEX, function (url) {
        const safe = escapeHtml(url);
        return '<a class="link" href="' + safe + '" target="_blank" rel="noopener noreferrer">' + safe + "</a>";
    });
}

function iconForName(name) {
    const ext = (String(name).split(".").pop() || "").toLowerCase();
    const map = {
        pdf: "📕", doc: "📘", docx: "📘", ppt: "📙", pptx: "📙",
        xls: "📗", xlsx: "📗", txt: "📄", zip: "📦",
    };
    return map[ext] || "📄";
}
