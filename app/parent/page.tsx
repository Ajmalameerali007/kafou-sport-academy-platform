import {ProtectedWorkspace} from '@/components/platform/protected-workspace';
export const dynamic='force-dynamic';
export const metadata={title:'KAFOU · Parent',robots:{index:false,follow:false}};
export default function Page(){return <ProtectedWorkspace workspace="parent"/>;}
