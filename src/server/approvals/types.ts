import "server-only";
/**
 * Importing this module registers every approval type's hooks with the engine.
 * Import it (first) from any page, action, job or test that decides or lists approvals.
 */
import "@/server/attendance/corrections";
