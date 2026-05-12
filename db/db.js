import mongoose from "mongoose";
import dotenv from 'dotenv'
dotenv.config()

const connectDB = async ()=>{
    try {
        await mongoose.connect(process.env.MONGO_URI)
        console.log('DataBase Connected');
    } catch (error) {
        console.log("Database Connection Failed",error);
    }
}

export default connectDB; 