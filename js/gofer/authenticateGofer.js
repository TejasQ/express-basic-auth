"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateGofer = void 0;
const cookie_1 = __importDefault(require("cookie"));
const http401_1 = require("../lib/http401");
const { deactivateUser, addLoginFailed, resetLoginFailedCount, updateLastLogin } = require("@pubcore/knex-auth");
const authenticateGofer = ({ db, res, req, options }) => {
    const { publicDeactivatedUri, changePasswordUri, publicCancelLoginUri } = options;
    return {
        noCredentials: () => http401_1.http401({ publicCancelLoginUri, res }),
        notFound: () => http401_1.http401({ publicCancelLoginUri, res }),
        isDeactivated: () => req.path !== publicDeactivatedUri && res.redirect(publicDeactivatedUri),
        toDeactivate: ({ username }) => deactivateUser(db, { username }).then(() => res.redirect(publicDeactivatedUri)),
        invalidWebToken: () => http401_1.http401({ publicCancelLoginUri, res }),
        invalidPassword: ({ username }) => addLoginFailed(db, { username }).then(() => http401_1.http401({ publicCancelLoginUri, res })),
        authenticated: (user, isTimeToUpdate) => {
            const { login_failed_count, username } = user;
            return Promise.resolve(login_failed_count > 0 && resetLoginFailedCount(db, { username }))
                .then(() => isTimeToUpdate && updateLastLogin(db, { username }))
                .then(() => user);
        },
        oldPwUsed: (user) => (user.oldPwUsed = true) && user,
        passwordExpired: () => {
            res.setHeader("Set-Cookie", cookie_1.default.serialize("back-uri", String(req.originalUrl), {
                httpOnly: true,
                path: "/",
                secure: true,
            }));
            req.path !== changePasswordUri && res.redirect(changePasswordUri);
        },
    };
};
exports.authenticateGofer = authenticateGofer;
