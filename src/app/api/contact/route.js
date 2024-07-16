import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import fs from "fs/promises";
import path from "path";

// Set up nodemailer transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USERNAME, // Your Gmail address
    pass: process.env.EMAIL_PASSWORD, // Your Gmail password or App password
  },
});

// Ensure the `tmp` directory exists
const tmpDir = path.join(process.cwd(), "tmp");

async function ensureTmpDirectoryExists() {
  try {
    await fs.access(tmpDir); // Check if tmpDir exists
  } catch (error) {
    if (error.code === "ENOENT") {
      await fs.mkdir(tmpDir); // Create tmpDir if it doesn't exist
    } else {
      throw error; // Propagate other errors
    }
  }
}

// This function will handle file uploads
async function handleFileUpload(req) {
  const formData = await req.formData();
  const name = formData.get("name");
  const email = formData.get("email");
  const service = formData.get("service");
  const message = formData.get("message");
  const resumeFile = formData.get("resume");

  if (!resumeFile) {
    throw new Error("Resume file is required");
  }

  const tempFilePath = path.join(tmpDir, resumeFile.name);
  console.log(tempFilePath);
  // Convert the file to a buffer and write to the file system
  const buffer = Buffer.from(await resumeFile.arrayBuffer());
  await fs.writeFile(tempFilePath, buffer);

  return { name, email, service, message, resumeFile, tempFilePath };
}

export const POST = async (req) => {
  try {
    await ensureTmpDirectoryExists(); // Ensure tmp directory exists

    const { name, email, service, message, resumeFile, tempFilePath } =
      await handleFileUpload(req);

    // Email content for the user
    const userMailOptions = {
      from: process.env.EMAIL_USERNAME,
      to: email,
      subject: "Thank you for contacting us!",
      text: `Hi ${name},\n\nThank you for reaching out to us regarding ${service}. We have received your message and will get back to you shortly.\n\nBest regards,\nNeeraj Singh Rajput`,
    };

    // Email content for yourself
    const adminMailOptions = {
      from: process.env.EMAIL_USERNAME,
      to: process.env.EMAIL_USERNAME,
      subject: "New contact form submission",
      text: `You have received a new message from your contact form:\n\nName: ${name}\nEmail: ${email}\nService: ${service}\nMessage: ${message}\n\nPlease respond promptly.`,
      attachments: [
        {
          filename: resumeFile.name,
          path: tempFilePath,
          contentType: resumeFile.type,
        },
      ],
    };

    // Send emails
    await transporter.sendMail(userMailOptions);
    await transporter.sendMail(adminMailOptions);

    // Clean up the temporary file
    await fs.unlink(tempFilePath);

    return NextResponse.json({
      success: true,
      message: "Form submitted successfully",
    });
  } catch (error) {
    console.error("Error processing form submission:", error);

    // Send the error details to the frontend
    return NextResponse.json(
      {
        success: false,
        message: "Failed to submit form",
        error: error,
        stack: error.stack,
      },
      { status: 500 }
    );
  }
};
