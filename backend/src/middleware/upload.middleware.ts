import fs from "fs";
import multer from "multer";
import path from "path";

const vehicleDir = path.join(process.cwd(), "uploads", "vehicles");
const ownershipDir = path.join(process.cwd(), "uploads", "ownership");

fs.mkdirSync(vehicleDir, { recursive: true });
fs.mkdirSync(ownershipDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, file, cb) => {
    if (file.fieldname === "vehicleImage") {
      cb(null, vehicleDir);
      return;
    }

    if (file.fieldname === "ownershipProof") {
      cb(null, ownershipDir);
      return;
    }

    cb(new Error("Invalid upload field"), "");
  },
  filename: (_req, file, cb) => {
    const extension = path.extname(file.originalname) || ".jpg";
    const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`;
    cb(null, filename);
  },
});

const imageOnlyFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  if (!file.mimetype.startsWith("image/")) {
    cb(new Error("Only image files are allowed"));
    return;
  }

  cb(null, true);
};

export const driverDocsUpload = multer({
  storage,
  fileFilter: imageOnlyFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 2,
  },
});
