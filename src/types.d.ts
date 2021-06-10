type User = {
  pk: number;
  username: string;
  password: string;
  oldPwUsed: boolena | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  password_secondary: string | null;
  password_expiry_date: string | null;
  login_expiry_date: string | null;
  created_time: string | null;
  deactivate: "yes" | "no";
  password_new: string | null;
  last_login: string;
  type: "HUMAN" | "SYSTEM";
  login_failed_count: number;
  last_login_failed: boolean | null;
};

declare namespace Express {
  export interface Request {
    user?: User;
  }
}

declare module "basic-auth" {
  export default (req: Express.Request) => ({ name: string, pass: string });
}
