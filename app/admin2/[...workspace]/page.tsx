import { AdminWorkspace } from "../../admin/ControlPlanePages2"
import {
  AdminIdentity,
  AdminLicenses,
  AdminTenants,
} from "../../admin/AdminPortal2"

type Admin2WorkspacePageProps = {
  params: Promise<{ workspace: string[] }>
}

export default async function Admin2WorkspacePage({
  params,
}: Admin2WorkspacePageProps) {
  const { workspace } = await params
  const route = workspace.join("-")
  if (route === "tenants") return <AdminTenants />
  if (route === "identity") return <AdminIdentity />
  if (route === "licenses") return <AdminLicenses />
  return <AdminWorkspace workspace={route} />
}
