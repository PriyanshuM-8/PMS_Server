import multer from "multer";
import cloudinary from "../db/cloudinary.js";
import { Readable } from "stream";

// Custom Cloudinary storage engine — works with multer v2
const cloudinaryStorage = {
  _handleFile(req, file, cb) {
    const folder = file.fieldname === "profileImage" ? "profileImage" : "aadharPhoto";
    const public_id = `${folder.replace("Photo", "")}_${Date.now()}`;

    const uploadStream = cloudinary.uploader.upload_stream(
      { folder, public_id, allowed_formats: ["jpg", "jpeg", "png"] },
      (error, result) => {
        if (error) return cb(error);
        cb(null, {
          fieldname: file.fieldname,
          secure_url: result.secure_url,
          public_id: result.public_id,
          size: result.bytes,
        });
      }
    );

    const readable = new Readable();
    const chunks = [];
    file.stream.on("data", (chunk) => chunks.push(chunk));
    file.stream.on("end", () => {
      readable.push(Buffer.concat(chunks));
      readable.push(null);
      readable.pipe(uploadStream);
    });
    file.stream.on("error", cb);
  },

  _removeFile(req, file, cb) {
    if (file.public_id) {
      cloudinary.uploader.destroy(file.public_id, cb);
    } else {
      cb(null);
    }
  },
};

const upload = multer({ storage: cloudinaryStorage });

export default upload;
