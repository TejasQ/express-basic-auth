"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.http401 = void 0;
const http401 = ({ publicCancelLoginUri, res }) => {
    const text = "Unauthorized (401)";
    res.status(401);
    res.append("WWW-Authenticate", 'Basic Realm="Pls cancel this dialog if you forgot your password."');
    res.format({
        "text/html": () => res.send(`<!DOCTYPE html>
<html><body>
	${text}
	<script>document.location.href='${publicCancelLoginUri}'</script>
</body></html>`),
        "application/json": () => res.send({ status: { code: "ERROR", text }, publicCancelLoginUri }),
        default: () => res.send(text + "; see " + publicCancelLoginUri),
    });
};
exports.http401 = http401;
