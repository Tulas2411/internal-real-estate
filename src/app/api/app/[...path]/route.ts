import { api, body } from "@/lib/http";
import { fail } from "@/lib/errors";
import * as properties from "@/services/properties";
import * as listings from "@/services/listings";
import * as files from "@/services/files";
import * as users from "@/services/users";
import * as administration from "@/services/admin";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };
async function handler(request: Request, context: Context) {
  const { path } = await context.params;
  const [resource, id, action] = path;
  const method = request.method;
  const query = Object.fromEntries(new URL(request.url).searchParams);
  return api(request, async actor => {
    if (path.length > 3) fail(404, "NOT_FOUND", "Không tìm thấy API.");
    if (resource === "me" && method === "GET") return actor;
    if (resource === "password" && method === "POST") return users.changePassword(actor, await body(request));
    if (resource === "dashboard" && method === "GET") return properties.dashboard(actor);
    if (resource === "properties") {
      if (!id && method === "GET") return properties.listProperties(actor, query);
      if (!id && method === "POST") return properties.createProperty(actor, await body(request));
      if (id && !action && method === "GET") return properties.getProperty(actor, id);
      if (id && !action && method === "PATCH") return properties.updateProperty(actor, id, await body(request));
      if (id && method === "POST") {
        if (action === "listings") return listings.createListing(actor, id, await body(request));
        if (action === "visibility") return properties.setVisibility(actor, id, await body(request));
        if (action === "owner") return properties.updateOwner(actor, id, await body(request));
        if (action === "permissions") return properties.grantPermission(actor, id, await body(request));
        if (action === "assign") return properties.assignProperty(actor, id, await body(request));
        if (action === "upload") return files.uploadFile(actor, id, request);
        if (action === "gallery") return files.reorderImages(actor, id, await body(request));
      }
    }
    if (resource === "listings" && id) {
      if (!action && method === "PATCH") return listings.updateListing(actor, id, await body(request));
      if (method === "POST") {
        if (action === "status") return listings.changeStatus(actor, id, await body(request));
        if (action === "confirm") return listings.confirmListing(actor, id, await body(request));
        if (action === "commission") return listings.updateCommission(actor, id, await body(request));
      }
    }
    if (["images", "documents"].includes(resource) && id) {
      if (method === "GET") return files.downloadFile(actor, id, resource === "documents");
      if (method === "DELETE") return files.deleteFile(actor, id, resource === "documents", await body(request));
    }
    if (resource === "users") {
      if (!id && method === "GET") return users.listUsers(actor);
      if (!id && method === "POST") return users.createUser(actor, await body(request));
      if (id && !action && method === "PATCH") return users.updateUser(actor, id, await body(request));
      if (id && action === "reset" && method === "POST") return users.resetUserPassword(actor, id, await body(request));
    }
    if (resource === "audit" && method === "GET") return administration.auditList(actor, query);
    if (resource === "permissions" && method === "GET") return administration.permissionList(actor);
    if (resource === "archived" && method === "GET") return administration.archivedList(actor);
    fail(404, "NOT_FOUND", "Không tìm thấy API.");
  }, resource === "me" || resource === "password");
}
export { handler as GET, handler as POST, handler as PATCH, handler as DELETE };
