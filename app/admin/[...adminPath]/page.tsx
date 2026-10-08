import { AdminWorkspace } from '../ControlPlanePages'

type AdminWorkspacePageProps = {
  params: Promise<{ adminPath: string[] }>
}

export default async function AdminWorkspacePage({ params }: AdminWorkspacePageProps) {
  const { adminPath } = await params
  return <AdminWorkspace workspace={adminPath.join('-')} />
}
