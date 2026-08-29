import {NextResponse} from 'next/server';
export async function POST(request){const {key=''}=await request.json();const keys=(process.env.ACCESS_KEYS||'').split(',').map(x=>x.trim().toUpperCase()).filter(Boolean);if(!keys.includes(key.trim().toUpperCase()))return NextResponse.json({ok:false},{status:401});return NextResponse.json({ok:true})}
