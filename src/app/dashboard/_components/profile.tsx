
type SessionUser = { 
    id?: string | undefined; 
    name?: string | null | undefined; 
    email?: string | null | undefined; 
    image?: string | null | undefined;
}

export default function ProfileSection (user: SessionUser) {
    return <div className="flex-1 lg:min-h-96 border border-pirrot-blue-500/5 rounded p-4 flex flex-col gap-4 relative">
    
    <h2 className="text-2xl uppercase font-bold">Profile</h2>
    <ul className="flex flex-col gap-2">
        <li>E-Mail: {user.email}</li>
    </ul>
   
        </div>
}