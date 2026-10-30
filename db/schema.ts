import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
export const cmsState = sqliteTable("cms_state", {
  id: text("id").primaryKey(),
  revision: integer("revision").notNull(),
  payload: text("payload").notNull(),
});
