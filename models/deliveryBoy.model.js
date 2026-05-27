import mongoose from "mongoose";

const deliveryBoySchema = new mongoose.Schema(
  {
    pump: { type: mongoose.Schema.Types.ObjectId, ref: "Pump", required: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true },
    password: { type: String, required: true },
    address: { type: String, required: true },
    aadharPhoto: { type: String, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("DeliveryBoy", deliveryBoySchema);
