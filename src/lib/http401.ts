import { Response } from "express";

type Options = {
  publicCancelLoginUri: string;
  res: Response;
};

export const http401 = ({ publicCancelLoginUri, res }: Options) => {
  const text = "Unauthorized (401)";
  res.status(401);
  res.append("WWW-Authenticate", 'Basic Realm="Pls cancel this dialog if you forgot your password."');
  res.format({
    "text/html": () =>
      res.send(`<!DOCTYPE html>
<html><body>
	${text}
	<script>document.location.href='${publicCancelLoginUri}'</script>
</body></html>`),
    "application/json": () => res.send({ status: { code: "ERROR", text }, publicCancelLoginUri }),
    default: () => res.send(text + "; see " + publicCancelLoginUri),
  });
};
