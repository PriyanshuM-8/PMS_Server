import { CloudinaryStorage } from "multer-storage-cloudinary";
import multer from "multer";
import cloudinary from "../db/cloudinary.js";

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    let folderName = "others";
    let publicId = Date.now(); // default

    if (file.fieldname === "profileImage") {
      folderName = "profileImage";
      publicId = "profile_" + Date.now();
    }

    if (file.fieldname === "aadharPhoto") {
      folderName = "aadharPhoto";
      publicId = "aadhar_" + Date.now();
    }

    return {
      folder: folderName,
      public_id: publicId,
      allowed_formats: ["jpg", "png", "jpeg"],
    };
  },
});

const upload = multer({ storage });

export default upload;