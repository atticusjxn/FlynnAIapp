import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      form_id,
      org_id,
      customer_name,
      customer_phone,
      customer_email,
      customer_address,
      answers,
      form_version,
      uploaded_files,
      estimate,
    } = body;

    // Validate required fields
    if (!form_id || !org_id || !customer_name || !customer_phone || !answers) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create quote submission
    const submissionData: any = {
      form_id,
      org_id,
      customer_name,
      customer_phone,
      customer_email: customer_email || null,
      customer_address: customer_address || null,
      answers,
      form_version,
      source: 'web',
      status: 'new',
      submitted_at: new Date().toISOString(),
    };

    // Add estimate data if provided
    if (estimate) {
      submissionData.estimated_price_min = estimate.min;
      submissionData.estimated_price_max = estimate.max;
      submissionData.estimate_shown_to_customer = estimate.shown_to_customer;
      submissionData.price_guide_rules_applied = estimate.rules_applied;
    }

    const { data: submission, error: submissionError } = await supabase
      .from('quote_submissions')
      .insert(submissionData)
      .select()
      .single();

    if (submissionError) {
      console.error('Error creating submission:', submissionError);
      return NextResponse.json(
        { error: 'Failed to create submission' },
        { status: 500 }
      );
    }

    // Link uploaded files to submission (if any)
    if (uploaded_files && uploaded_files.length > 0) {
      const { error: mediaError } = await supabase
        .from('quote_submission_media')
        .update({ submission_id: submission.id })
        .in('id', uploaded_files);

      if (mediaError) {
        console.error('Error linking media:', mediaError);
        // Non-fatal - submission already created
      }
    }

    // Log analytics event
    await supabase.from('quote_link_events').insert({
      form_id,
      submission_id: submission.id,
      org_id,
      event_type: 'form_submitted',
      event_data: {
        has_media: uploaded_files && uploaded_files.length > 0,
        media_count: uploaded_files?.length || 0,
        has_estimate: !!estimate,
      },
    });

    return NextResponse.json({
      success: true,
      submission_id: submission.id,
    });
  } catch (error) {
    console.error('Error in submit API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
