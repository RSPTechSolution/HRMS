export type SeedPerson = {
  name: string;
  designation: string;
  dept: string;
  manager: string | null;
  email?: string;
  isHR?: boolean;
  isPayroll?: boolean;
  isAdmin?: boolean;
  status?: "ACTIVE" | "NOTICE";
};

export const DEMO_PASSWORD = "Password@123";

export const DEPARTMENTS = ["Leadership", "Engineering", "Design", "QA", "Sales", "People"] as const;

export const PEOPLE: SeedPerson[] = [
  { name: "Vikas Malhotra", designation: "Chief Executive Officer", dept: "Leadership", manager: null, email: "admin@lnwebworks.test", isAdmin: true },
  // Engineering
  { name: "Ananya Sharma", designation: "Engineering Manager", dept: "Engineering", manager: "Vikas Malhotra", email: "manager@lnwebworks.test" },
  { name: "Rahul Verma", designation: "Engineering Manager", dept: "Engineering", manager: "Vikas Malhotra" },
  { name: "Arjun Mehta", designation: "Senior Developer", dept: "Engineering", manager: "Ananya Sharma", email: "employee@lnwebworks.test" },
  { name: "Karan Joshi", designation: "Drupal Developer", dept: "Engineering", manager: "Ananya Sharma" },
  { name: "Simran Kaur", designation: "Frontend Developer", dept: "Engineering", manager: "Ananya Sharma" },
  { name: "Vikram Rathore", designation: "DevOps Engineer", dept: "Engineering", manager: "Ananya Sharma" },
  { name: "Aditya Singh", designation: "Backend Developer", dept: "Engineering", manager: "Ananya Sharma" },
  { name: "Manish Gupta", designation: "Drupal Developer", dept: "Engineering", manager: "Ananya Sharma" },
  { name: "Sneha Reddy", designation: "Frontend Developer", dept: "Engineering", manager: "Ananya Sharma" },
  { name: "Rohan Das", designation: "Full Stack Developer", dept: "Engineering", manager: "Ananya Sharma" },
  { name: "Kavya Iyer", designation: "Software Engineer", dept: "Engineering", manager: "Ananya Sharma" },
  { name: "Nikhil Bhatia", designation: "Software Engineer", dept: "Engineering", manager: "Ananya Sharma" },
  { name: "Tanvi Shah", designation: "Associate Developer", dept: "Engineering", manager: "Ananya Sharma" },
  { name: "Harpreet Gill", designation: "Senior Developer", dept: "Engineering", manager: "Rahul Verma" },
  { name: "Gaurav Saini", designation: "Drupal Developer", dept: "Engineering", manager: "Rahul Verma" },
  { name: "Deepak Yadav", designation: "Backend Developer", dept: "Engineering", manager: "Rahul Verma" },
  { name: "Shreya Kapoor", designation: "Frontend Developer", dept: "Engineering", manager: "Rahul Verma" },
  { name: "Amit Chauhan", designation: "Mobile Developer", dept: "Engineering", manager: "Rahul Verma" },
  { name: "Pallavi Jain", designation: "Software Engineer", dept: "Engineering", manager: "Rahul Verma" },
  { name: "Saurabh Mishra", designation: "Full Stack Developer", dept: "Engineering", manager: "Rahul Verma" },
  { name: "Jaspreet Sandhu", designation: "Drupal Developer", dept: "Engineering", manager: "Rahul Verma" },
  { name: "Varun Thakur", designation: "Associate Developer", dept: "Engineering", manager: "Rahul Verma" },
  { name: "Ritika Bose", designation: "Software Engineer", dept: "Engineering", manager: "Rahul Verma" },
  // Design
  { name: "Ishita Gupta", designation: "Design Lead", dept: "Design", manager: "Vikas Malhotra" },
  { name: "Riya Kapoor", designation: "UI Designer", dept: "Design", manager: "Ishita Gupta" },
  { name: "Mehak Arora", designation: "Product Designer", dept: "Design", manager: "Ishita Gupta" },
  { name: "Kunal Sethi", designation: "UX Designer", dept: "Design", manager: "Ishita Gupta" },
  { name: "Divya Nair", designation: "Visual Designer", dept: "Design", manager: "Ishita Gupta" },
  { name: "Abhinav Rao", designation: "Motion Designer", dept: "Design", manager: "Ishita Gupta" },
  // QA
  { name: "Priya Singh", designation: "QA Lead", dept: "QA", manager: "Vikas Malhotra" },
  { name: "Aman Thakur", designation: "QA Engineer", dept: "QA", manager: "Priya Singh" },
  { name: "Neeraj Kumar", designation: "Automation Engineer", dept: "QA", manager: "Priya Singh" },
  { name: "Swati Pandey", designation: "QA Engineer", dept: "QA", manager: "Priya Singh" },
  { name: "Rajat Sharma", designation: "QA Engineer", dept: "QA", manager: "Priya Singh" },
  { name: "Komal Bajwa", designation: "QA Analyst", dept: "QA", manager: "Priya Singh" },
  { name: "Yash Agarwal", designation: "Automation Engineer", dept: "QA", manager: "Priya Singh" },
  // Sales
  { name: "Meera Nair", designation: "Sales Lead", dept: "Sales", manager: "Vikas Malhotra" },
  { name: "Rohit Bansal", designation: "Business Analyst", dept: "Sales", manager: "Meera Nair" },
  { name: "Ankit Tiwari", designation: "Business Development Executive", dept: "Sales", manager: "Meera Nair" },
  { name: "Sakshi Dhillon", designation: "Account Manager", dept: "Sales", manager: "Meera Nair" },
  { name: "Mohit Khurana", designation: "Business Development Executive", dept: "Sales", manager: "Meera Nair", status: "NOTICE" },
  // People
  { name: "Neha Verma", designation: "HR Generalist", dept: "People", manager: "Vikas Malhotra", email: "hr@lnwebworks.test", isHR: true },
  { name: "Pooja Arora", designation: "Payroll Executive", dept: "People", manager: "Neha Verma", email: "payroll@lnwebworks.test", isPayroll: true },
  { name: "Sonia Grewal", designation: "HR Executive", dept: "People", manager: "Neha Verma", isHR: true },
  { name: "Tarun Batra", designation: "IT Administrator", dept: "People", manager: "Neha Verma" },
  { name: "Lakshmi Menon", designation: "Office Administrator", dept: "People", manager: "Neha Verma" },
  { name: "Ravi Prakash", designation: "Recruiter", dept: "People", manager: "Neha Verma" },
];

export const DEMO_LOGINS = PEOPLE.filter((p) => p.email).map((p) => ({ email: p.email!, name: p.name }));

/** Recent joiners still on probation (everyone else joined between 2020 and 2025). */
export const RECENT_JOINERS: Record<string, { joinedOn: string; probationEndsOn: string }> = {
  "Tarun Batra": { joinedOn: "2026-06-15", probationEndsOn: "2026-12-15" },
  "Lakshmi Menon": { joinedOn: "2026-08-03", probationEndsOn: "2027-02-03" },
  "Ravi Prakash": { joinedOn: "2026-09-21", probationEndsOn: "2027-03-21" },
};

/** Demo holiday calendar for 2026 (HR manages the real list from Phase 1b). */
export const HOLIDAYS_2026: { date: string; name: string }[] = [
  { date: "2026-01-26", name: "Republic Day" },
  { date: "2026-03-04", name: "Holi" },
  { date: "2026-08-15", name: "Independence Day" },
  { date: "2026-10-02", name: "Gandhi Jayanti" },
  { date: "2026-10-20", name: "Dussehra" },
  { date: "2026-11-08", name: "Diwali" },
  { date: "2026-11-09", name: "Govardhan Puja" },
  { date: "2026-11-24", name: "Guru Nanak Jayanti" },
  { date: "2026-12-25", name: "Christmas" },
];

export const FEMALE_FIRST_NAMES = new Set([
  "Ananya", "Simran", "Sneha", "Kavya", "Tanvi", "Shreya", "Pallavi", "Ritika", "Ishita", "Riya", "Mehak", "Divya",
  "Priya", "Swati", "Komal", "Meera", "Sakshi", "Neha", "Pooja", "Sonia", "Lakshmi",
]);

export const APPROVAL_POLICIES: Record<string, ("MANAGER" | "HR")[]> = {
  LEAVE: ["MANAGER", "HR"],
  WFH: ["MANAGER", "HR"],
  ATTENDANCE_CORRECTION: ["MANAGER"],
  TIMESHEET_WEEK: ["MANAGER"],
  RESIGNATION: ["MANAGER", "HR"],
  GOAL_SET: ["MANAGER"],
};
