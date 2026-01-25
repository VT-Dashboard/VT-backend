import express from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const router = express.Router();

function resolveCertPath() {
  return path.resolve(process.env.QZ_CERT_PATH || "cert.pem");
}

function loadPrivateKey() {
  if (process.env.QZ_PRIVATE_KEY) {
    // Allow env var to store newlines as \n
    return process.env.QZ_PRIVATE_KEY.replace(/\\n/g, "\n");
  }
  if (process.env.QZ_PRIVATE_KEY_PATH) {
    return fs.readFileSync(path.resolve(process.env.QZ_PRIVATE_KEY_PATH), "utf8");
  }
  return null;
}

router.get("/cert.pem", (req, res) => {
  const certPath = resolveCertPath();
  if (!fs.existsSync(certPath)) {
    return res.status(404).json({ error: "cert.pem not found" });
  }
  return res.sendFile(certPath);
});

router.post("/sign", (req, res) => {
  const { toSign } = req.body || {};
  if (!toSign) {
    return res.status(400).json({ error: "Missing toSign" });
  }
  const privateKey = loadPrivateKey();
  if (!privateKey) {
    return res.status(500).json({ error: "Signing key not configured" });
  }

  const signer = crypto.createSign("RSA-SHA256");
  signer.update(toSign, "utf8");
  signer.end();
  const signature = signer.sign(privateKey, "base64");

  return res.type("text/plain").send(signature);
});

export default router;
