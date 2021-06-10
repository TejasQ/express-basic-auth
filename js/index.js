"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.basicAuth = void 0;
const fs_1 = require("fs");
const basic_auth_1 = __importDefault(require("basic-auth"));
const authenticate = require("@pubcore/authentication").default;
const gofer = require("./gofer/authenticateGofer").default;
const knexAuth = require("@pubcore/knex-auth");
const getUser = knexAuth.default;
const { comparePassword } = knexAuth;
const defaultAuthenticateOptions = {
    maxTimeWithoutActivity: 1000 * 60 * 60 * 24 * 180,
    maxLoginAttempts: 5,
    maxLoginAttemptsTimeWindow: 1000 * 60 * 60 * 24,
};
const httpOptions = {
    changePasswordUri: "/login/pwChange",
    publicDeactivatedUri: "/login/deactivated",
    publicCancelLoginUri: "/login/canceled",
};
const loadSecret = (pathToFile) => new Promise((resolve, reject) => fs_1.readFile(pathToFile, { encoding: "utf8" }, (err, data) => (err ? reject(err) : resolve(data.trim()))));
const basicAuth = ({ db, options }) => async (req, res, next) => {
    try {
        const { name, pass } = basic_auth_1.default(req) || {};
        const { cookies } = req;
        const { Jwt } = cookies || {};
        const jwtList = (cookies || {})["Jwt"];
        const user = await authenticate({
            jwt: Jwt,
            jwtList,
            username: name,
            password: pass,
            gofer: gofer({
                db,
                req,
                res,
                options: { ...httpOptions, ...options },
            }),
            carrier: {
                getOptions: async () => {
                    return {
                        ...defaultAuthenticateOptions,
                        ...options,
                        jwtKey: options.jwtKeyFile ? await loadSecret(options.jwtKeyFile) : "",
                    };
                },
                getUser: ({ username }) => getUser({ ...db, cols: ["first_name", "last_name", "email"] }, { username }),
            },
            lib: { comparePassword },
        });
        if (typeof user !== "undefined") {
            req.user = user;
        }
        next();
    }
    catch (e) {
        next(e);
    }
};
exports.basicAuth = basicAuth;
