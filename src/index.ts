import Knex from "knex";
import { readFile } from "fs";
import defaultBasicAuth from "basic-auth";
import { Handler } from "express";

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
const loadSecret = (pathToFile: string): Promise<string> =>
  new Promise((resolve, reject) =>
    readFile(pathToFile, { encoding: "utf8" }, (err, data) => (err ? reject(err) : resolve(data.trim())))
  );

export type MainOptions = {
  db: Knex;
  options: {
    comparePassword: (password: string) => Promise<boolean>;
    jwtKeyFile: string;
    publicDeactivatedUri: string;
    changePasswordUri: string;
    publicCancelLoginUri: string;
  };
};

export const basicAuth =
  ({ db, options }: MainOptions): Handler =>
  async (req, res, next) => {
    try {
      const { name, pass } = defaultBasicAuth(req) || {};
      const { cookies } = req;
      const { Jwt } = cookies || {};
      const jwtList = (cookies || {})["Jwt"];

      const user: User = await authenticate({
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
          getUser: ({ username }: { username: string }) =>
            getUser({ ...db, cols: ["first_name", "last_name", "email"] }, { username }),
        },
        lib: { comparePassword: options.comparePassword || comparePassword },
      });

      if (typeof user !== "undefined") {
        req.user = user;
      }

      next();
    } catch (e) {
      next(e);
    }
  };
