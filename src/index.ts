import Knex from "knex";
import { readFile } from "fs";
import defaultBasicAuth from "basic-auth";
import { Handler } from "express";
import { authenticateGofer } from "./gofer/authenticateGofer";

const authenticate = require("@pubcore/authentication").default;
const knexAuth = require("@pubcore/knex-auth");
const getUser = knexAuth.default;

const { comparePassword } = knexAuth;
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
  options?: {
    comparePassword?: (password: string, hash: string) => Promise<boolean>;
    jwtKeyFile?: string;
    publicDeactivatedUri?: string;
    changePasswordUri?: string;
    publicCancelLoginUri?: string;
    /** Max time (in milliseconds) between logins before an account is deactivated */
    maxTimeWithoutActivity?: number;
    maxLoginAttempts?: number;
    /** In milliseconds */
    maxLoginAttemptsTimeWindow?: number;
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
      const defaultAuthenticateOptions: Partial<MainOptions["options"]> = {
        maxTimeWithoutActivity: Infinity,
        maxLoginAttempts: 5,
        maxLoginAttemptsTimeWindow: 1000 * 60 * 60 * 24,
      };

      const user: User = await authenticate({
        jwt: Jwt,
        jwtList,
        username: name,
        password: pass,
        gofer: authenticateGofer({
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
              jwtKey: options?.jwtKeyFile ? await loadSecret(options.jwtKeyFile) : "",
            };
          },
          getUser: ({ username }: { username: string }) =>
            getUser({ ...db, cols: ["first_name", "last_name", "email"] }, { username }),
        },
        lib: { comparePassword: options?.comparePassword ?? comparePassword },
      });

      if (typeof user !== "undefined") {
        req.user = user;
      }

      next();
    } catch (e) {
      next(e);
    }
  };
