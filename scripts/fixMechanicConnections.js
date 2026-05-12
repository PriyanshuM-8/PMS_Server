import mongoose from "mongoose";
import dotenv from "dotenv";
import Mechanic from "../models/mechanic.model.js";
import Pump from "../models/pump.model.js";

dotenv.config();

await mongoose.connect(process.env.MONGO_URI);
console.log("DB Connected");

const pumps = await Pump.find({ approvalStatus: "approved" }, "_id");
const mechanics = await Mechanic.find({ pumpConnections: { $size: 0 } });

for (const m of mechanics) {
  m.pumpConnections = pumps.map((p) => ({ pump: p._id, status: "pending" }));
  await m.save();
  console.log("Fixed:", m.name);
}

console.log("Total fixed:", mechanics.length);
process.exit(0);
