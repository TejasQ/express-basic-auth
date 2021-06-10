import { Request, Response } from "express";
import Knex from "knex";
import cookie from "cookie";

import type { MainOptions } from "../index";
import { http401 } from "../lib/http401";

const { deactivateUser, addLoginFailed, resetLoginFailedCount, updateLastLogin } = require("@pubcore/knex-auth");

type Options = {
  db: Knex;
  res: Response;
  req: Request;
  options: MainOptions["options"];
};

export const authenticateGofer = ({ db, res, req, options }: Options) => {
  const {
    publicDeactivatedUri = "/deactivated",
    changePasswordUri = "/reset-password",
    publicCancelLoginUri = "/cancel",
  } = options;

  return {
    noCredentials: () => http401({ publicCancelLoginUri, res }),
    notFound: () => http401({ publicCancelLoginUri, res }),
    isDeactivated: () => req.path !== publicDeactivatedUri && res.redirect(publicDeactivatedUri),
    toDeactivate: ({ username }: { username: string }) =>
      deactivateUser(db, { username }).then(() => res.redirect(publicDeactivatedUri)),
    invalidWebToken: () => http401({ publicCancelLoginUri, res }),
    invalidPassword: ({ username }: { username: string }) =>
      addLoginFailed(db, { username }).then(() => http401({ publicCancelLoginUri, res })),
    authenticated: (user: User, isTimeToUpdate: boolean) => {
      const { login_failed_count, username } = user;
      return Promise.resolve(login_failed_count > 0 && resetLoginFailedCount(db, { username }))
        .then(() => isTimeToUpdate && updateLastLogin(db, { username }))
        .then(() => user);
    },
    oldPwUsed: (user: User) => (user.oldPwUsed = true) && user,
    passwordExpired: () => {
      res.setHeader(
        "Set-Cookie",
        cookie.serialize("back-uri", String(req.originalUrl), {
          httpOnly: true,
          path: "/",
          secure: true,
        })
      );
      req.path !== changePasswordUri && res.redirect(changePasswordUri);
    },
  };
};
