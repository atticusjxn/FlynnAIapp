import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';

// Use service role for storage operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { fileId, fileName, mimeType, fileSize } = body;

    if (!fileId || !fileName || !mimeType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Determine media type
    const mediaType = mimeType.startsWith('image/') ? 'photo' : 'video';

    // Generate file path
    const timestamp = Date.now();
    const extension = fileName.split('.').pop() || 'bin';
    const filePath = `temp/${fileId}/${timestamp}.${extension}`;

    // Create media record in database
    const { data: mediaRecord, error: dbError } = await supabase
      .from('quote_submission_media')
      .insert({
        id: fileId,
        submission_id: null, // Will be linked when submission is created
        media_type: mediaType,
        original_filename: fileName,
        mime_type: mimeType,
        file_size_bytes: fileSize,
        file_url: filePath, // Store path for now
        upload_status: 'pending',
        scan_status: 'pending',
      })
      .select()
      .single();

    if (dbError) {
      console.error('Error creating media record:', dbError);
      return NextResponse.json(
        { error: 'Failed to create media record' },
        { status: 500 }
      );
    }

    // Create signed upload URL
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('quote-submissions')
      .createSignedUploadUrl(filePath);

    if (uploadError) {
      console.error('Error creating upload URL:', uploadError);
      return NextResponse.json(
        { error: 'Failed to create upload URL' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      uploadUrl: uploadData.signedUrl,
      filePath,
      mediaId: fileId,
    });
  } catch (error) {
    console.error('Error in upload API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
