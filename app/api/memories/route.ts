import { NextRequest, NextResponse } from 'next/server';
import PostgresService from '@/services/postgres-service';

// POST /api/memories - Create a new memory
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, businessId, content, type, isCompleted } = body;
    
    if (!id || !businessId || !content || !type) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }
    
    const pgService = PostgresService.getInstance();
    const memoryId = await pgService.storeMemory({ id, businessId, content, type, isCompleted });
    
    return NextResponse.json({ success: true, memoryId });
  } catch (error: any) {
    console.error('Error creating memory:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// GET /api/memories - Get all memories for a business
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const businessId = url.searchParams.get('businessId');
    
    if (!businessId) {
      return NextResponse.json({ success: false, error: 'Business ID is required' }, { status: 400 });
    }
    
    const pgService = PostgresService.getInstance();
    const memories = await pgService.getMemories(businessId);
    
    return NextResponse.json({ success: true, memories });
  } catch (error: any) {
    console.error('Error fetching memories:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PATCH /api/memories/:id - Update a memory
export async function PATCH(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const memoryId = url.searchParams.get('id');
    const businessId = url.searchParams.get('businessId');
    
    if (!memoryId || !businessId) {
      return NextResponse.json({ success: false, error: 'Memory ID and Business ID are required' }, { status: 400 });
    }
    
    const body = await request.json();
    const { content, isCompleted } = body;
    
    if (content === undefined && isCompleted === undefined) {
      return NextResponse.json({ success: false, error: 'No update fields provided' }, { status: 400 });
    }
    
    const pgService = PostgresService.getInstance();
    const success = await pgService.updateMemory(memoryId, businessId, { content, isCompleted });
    
    if (!success) {
      return NextResponse.json({ success: false, error: 'Memory not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating memory:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE /api/memories/:id - Delete a memory
export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const memoryId = url.searchParams.get('id');
    const businessId = url.searchParams.get('businessId');
    
    if (!memoryId || !businessId) {
      return NextResponse.json({ success: false, error: 'Memory ID and Business ID are required' }, { status: 400 });
    }
    
    const pgService = PostgresService.getInstance();
    const success = await pgService.deleteMemory(memoryId, businessId);
    
    if (!success) {
      return NextResponse.json({ success: false, error: 'Memory not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting memory:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}