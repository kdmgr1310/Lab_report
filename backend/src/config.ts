export const appConfig = {
  labName: process.env.LAB_NAME ?? "Niramaya Lab Services",
  labLocation: process.env.LAB_LOCATION ?? "Vijayawada · Coastal Andhra",
  staffName: process.env.STAFF_DISPLAY_NAME ?? "Front desk",
  staffRole: process.env.STAFF_ROLE ?? "Front desk",
  staffId: process.env.STAFF_ID ?? "demo-frontdesk",
  staffRoleCode: process.env.STAFF_ROLE_CODE ?? "frontdesk",
  staffDoctorId: process.env.STAFF_DOCTOR_ID ? Number(process.env.STAFF_DOCTOR_ID) : undefined,
};
