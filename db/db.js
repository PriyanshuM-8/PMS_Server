import mongoose from "mongoose";
import dotenv from 'dotenv'
dotenv.config()

const connectDB = async ()=>{
    try {
        console.log('⏳ Connecting to MongoDB...');
        if (!process.env.MONGO_URI) {
            console.error('❌ FATAL ERROR: MONGO_URI is NOT defined in Environment Variables!');
            process.exit(1);
        }
        await mongoose.connect(process.env.MONGO_URI)
        console.log('✅ DataBase Connected Successfully');
    } catch (error) {
        console.error("❌ Database Connection Failed:");
        console.error("Error Message:", error.message);
        console.error("Full Error:", error);
        process.exit(1);
    }
}

export default connectDB;