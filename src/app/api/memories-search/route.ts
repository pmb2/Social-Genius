import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/services/database';

// POST /api/memories-search - Find semantically similar memories
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, businessId, limit = 5, similarityThreshold = 0.7 } = body;
    
    if (!query || !businessId) {
      return NextResponse.json({ success: false, error: 'Query and Business ID are required' }, { status: 400 });
    }
    
    const pgService = DatabaseService.getInstance();
    const memories = await pgService.findSimilarMemories(query, businessId, limit, similarityThreshold);
    
    return NextResponse.json({ success: true, memories });
  } catch (error: any) {
    console.error('Error searching memories:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}