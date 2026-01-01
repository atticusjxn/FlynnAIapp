/**
 * Quote Analytics Service
 *
 * Provides conversion metrics, funnel analysis, and performance tracking
 * for quote forms and submissions.
 */

import { supabase } from './supabase';
import type { QuoteLinkAnalytics } from '../types/quoteLinks';

interface FunnelMetrics {
  link_opened: number;
  form_started: number;
  questions_completed: number;
  media_uploaded: number;
  form_submitted: number;
  conversion_rate: number;
  completion_rate: number;
  media_upload_rate: number;
}

interface SubmissionMetrics {
  total: number;
  new: number;
  reviewing: number;
  quoted: number;
  won: number;
  lost: number;
  win_rate: number;
  average_response_time_hours: number;
}

interface SourceBreakdown {
  source: string;
  count: number;
  percentage: number;
}

interface TimeSeriesData {
  date: string;
  submissions: number;
  conversions: number;
}

class QuoteAnalyticsService {
  /**
   * Get comprehensive analytics for a quote form
   */
  async getFormAnalytics(formId: string, dateRange?: { start: Date; end: Date }): Promise<QuoteLinkAnalytics> {
    const startDate = dateRange?.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = dateRange?.end || new Date();

    // Get funnel metrics
    const funnel = await this.getFunnelMetrics(formId, startDate, endDate);

    // Get submission breakdown
    const submissions = await this.getSubmissionMetrics(formId, startDate, endDate);

    // Get source breakdown
    const sources = await this.getSourceBreakdown(formId, startDate, endDate);

    // Get drop-off analysis
    const topDropOffQuestion = await this.getTopDropOffQuestion(formId, startDate, endDate);

    return {
      form_id: formId,
      total_opens: funnel.link_opened,
      total_started: funnel.form_started,
      total_submitted: funnel.form_submitted,
      conversion_rate: funnel.conversion_rate,
      completion_rate: funnel.completion_rate,
      average_time_to_submit: await this.getAverageTimeToSubmit(formId, startDate, endDate),
      media_upload_rate: funnel.media_upload_rate,
      estimate_view_rate: await this.getEstimateViewRate(formId, startDate, endDate),
      top_drop_off_question: topDropOffQuestion,
      submissions_by_status: {
        new: submissions.new,
        reviewing: submissions.reviewing,
        quoted: submissions.quoted,
        won: submissions.won,
        lost: submissions.lost,
        archived: 0,
      },
      submissions_by_source: sources.reduce((acc, s) => {
        acc[s.source] = s.count;
        return acc;
      }, {} as Record<string, number>),
    };
  }

  /**
   * Get funnel conversion metrics
   */
  private async getFunnelMetrics(
    formId: string,
    startDate: Date,
    endDate: Date
  ): Promise<FunnelMetrics> {
    const { data: events, error } = await supabase
      .from('quote_link_events')
      .select('event_type')
      .eq('form_id', formId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (error) {
      console.error('Error fetching funnel metrics:', error);
      return {
        link_opened: 0,
        form_started: 0,
        questions_completed: 0,
        media_uploaded: 0,
        form_submitted: 0,
        conversion_rate: 0,
        completion_rate: 0,
        media_upload_rate: 0,
      };
    }

    const counts = (events || []).reduce((acc, event) => {
      acc[event.event_type] = (acc[event.event_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const link_opened = counts.link_opened || 0;
    const form_started = counts.form_started || 0;
    const media_uploaded = counts.media_uploaded || 0;
    const form_submitted = counts.form_submitted || 0;

    const conversion_rate = link_opened > 0 ? (form_submitted / link_opened) * 100 : 0;
    const completion_rate = form_started > 0 ? (form_submitted / form_started) * 100 : 0;
    const media_upload_rate = form_submitted > 0 ? (media_uploaded / form_submitted) * 100 : 0;

    return {
      link_opened,
      form_started,
      questions_completed: form_started,
      media_uploaded,
      form_submitted,
      conversion_rate: Math.round(conversion_rate * 10) / 10,
      completion_rate: Math.round(completion_rate * 10) / 10,
      media_upload_rate: Math.round(media_upload_rate * 10) / 10,
    };
  }

  /**
   * Get submission status breakdown
   */
  private async getSubmissionMetrics(
    formId: string,
    startDate: Date,
    endDate: Date
  ): Promise<SubmissionMetrics> {
    const { data: submissions, error } = await supabase
      .from('quote_submissions')
      .select('status, submitted_at, quoted_at')
      .eq('form_id', formId)
      .gte('submitted_at', startDate.toISOString())
      .lte('submitted_at', endDate.toISOString());

    if (error) {
      console.error('Error fetching submission metrics:', error);
      return {
        total: 0,
        new: 0,
        reviewing: 0,
        quoted: 0,
        won: 0,
        lost: 0,
        win_rate: 0,
        average_response_time_hours: 0,
      };
    }

    const statusCounts = (submissions || []).reduce((acc, sub) => {
      acc[sub.status] = (acc[sub.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const total = submissions?.length || 0;
    const won = statusCounts.won || 0;
    const lost = statusCounts.lost || 0;
    const win_rate = won + lost > 0 ? (won / (won + lost)) * 100 : 0;

    // Calculate average response time
    const responseTimes = (submissions || [])
      .filter((s) => s.quoted_at)
      .map((s) => {
        const submitted = new Date(s.submitted_at).getTime();
        const quoted = new Date(s.quoted_at!).getTime();
        return (quoted - submitted) / (1000 * 60 * 60); // Hours
      });

    const average_response_time_hours =
      responseTimes.length > 0
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
        : 0;

    return {
      total,
      new: statusCounts.new || 0,
      reviewing: statusCounts.reviewing || 0,
      quoted: statusCounts.quoted || 0,
      won,
      lost,
      win_rate: Math.round(win_rate * 10) / 10,
      average_response_time_hours: Math.round(average_response_time_hours * 10) / 10,
    };
  }

  /**
   * Get source breakdown (web, sms, call, direct)
   */
  private async getSourceBreakdown(
    formId: string,
    startDate: Date,
    endDate: Date
  ): Promise<SourceBreakdown[]> {
    const { data: submissions, error } = await supabase
      .from('quote_submissions')
      .select('source')
      .eq('form_id', formId)
      .gte('submitted_at', startDate.toISOString())
      .lte('submitted_at', endDate.toISOString());

    if (error) {
      console.error('Error fetching source breakdown:', error);
      return [];
    }

    const sourceCounts = (submissions || []).reduce((acc, sub) => {
      acc[sub.source] = (acc[sub.source] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const total = submissions?.length || 0;

    return Object.entries(sourceCounts).map(([source, count]) => ({
      source,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100 * 10) / 10 : 0,
    }));
  }

  /**
   * Find question with highest drop-off rate
   */
  private async getTopDropOffQuestion(
    formId: string,
    startDate: Date,
    endDate: Date
  ): Promise<string | null> {
    // Get all question_answered events
    const { data: events, error } = await supabase
      .from('quote_link_events')
      .select('event_data')
      .eq('form_id', formId)
      .eq('event_type', 'question_answered')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (error || !events || events.length === 0) {
      return null;
    }

    // Count answers per question
    const questionCounts: Record<string, number> = {};
    events.forEach((event) => {
      const questionId = event.event_data?.question_id;
      if (questionId) {
        questionCounts[questionId] = (questionCounts[questionId] || 0) + 1;
      }
    });

    // Find question with biggest drop-off (lowest count)
    let minCount = Infinity;
    let topDropOffQuestionId: string | null = null;

    Object.entries(questionCounts).forEach(([questionId, count]) => {
      if (count < minCount) {
        minCount = count;
        topDropOffQuestionId = questionId;
      }
    });

    return topDropOffQuestionId;
  }

  /**
   * Get average time to submit (seconds)
   */
  private async getAverageTimeToSubmit(
    formId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    const { data: sessions, error } = await supabase
      .from('quote_link_events')
      .select('session_id, created_at, event_type')
      .eq('form_id', formId)
      .in('event_type', ['form_started', 'form_submitted'])
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (error || !sessions) {
      return 0;
    }

    // Group by session
    const sessionMap: Record<string, { start?: Date; end?: Date }> = {};

    sessions.forEach((event) => {
      if (!event.session_id) return;

      if (!sessionMap[event.session_id]) {
        sessionMap[event.session_id] = {};
      }

      const eventDate = new Date(event.created_at);

      if (event.event_type === 'form_started') {
        sessionMap[event.session_id].start = eventDate;
      } else if (event.event_type === 'form_submitted') {
        sessionMap[event.session_id].end = eventDate;
      }
    });

    // Calculate durations
    const durations = Object.values(sessionMap)
      .filter((s) => s.start && s.end)
      .map((s) => (s.end!.getTime() - s.start!.getTime()) / 1000); // Seconds

    if (durations.length === 0) return 0;

    return Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
  }

  /**
   * Get estimate view rate
   */
  private async getEstimateViewRate(
    formId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    const { data: events, error } = await supabase
      .from('quote_link_events')
      .select('event_type')
      .eq('form_id', formId)
      .in('event_type', ['form_submitted', 'estimate_viewed'])
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (error || !events || events.length === 0) {
      return 0;
    }

    const submitted = events.filter((e) => e.event_type === 'form_submitted').length;
    const viewed = events.filter((e) => e.event_type === 'estimate_viewed').length;

    return submitted > 0 ? Math.round((viewed / submitted) * 100 * 10) / 10 : 0;
  }

  /**
   * Get time series data for charts
   */
  async getTimeSeriesData(
    formId: string,
    startDate: Date,
    endDate: Date,
    granularity: 'day' | 'week' | 'month' = 'day'
  ): Promise<TimeSeriesData[]> {
    const { data: submissions, error } = await supabase
      .from('quote_submissions')
      .select('submitted_at, status')
      .eq('form_id', formId)
      .gte('submitted_at', startDate.toISOString())
      .lte('submitted_at', endDate.toISOString());

    if (error || !submissions) {
      return [];
    }

    // Group by date
    const groupedData: Record<string, { submissions: number; conversions: number }> = {};

    submissions.forEach((sub) => {
      const date = new Date(sub.submitted_at);
      let key: string;

      if (granularity === 'day') {
        key = date.toISOString().split('T')[0];
      } else if (granularity === 'week') {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split('T')[0];
      } else {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }

      if (!groupedData[key]) {
        groupedData[key] = { submissions: 0, conversions: 0 };
      }

      groupedData[key].submissions++;

      if (sub.status === 'won') {
        groupedData[key].conversions++;
      }
    });

    return Object.entries(groupedData)
      .map(([date, data]) => ({
        date,
        submissions: data.submissions,
        conversions: data.conversions,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Get comparison data between two date ranges
   */
  async getComparisonData(
    formId: string,
    currentStart: Date,
    currentEnd: Date,
    previousStart: Date,
    previousEnd: Date
  ): Promise<{
    current: FunnelMetrics;
    previous: FunnelMetrics;
    changes: Record<string, number>;
  }> {
    const current = await this.getFunnelMetrics(formId, currentStart, currentEnd);
    const previous = await this.getFunnelMetrics(formId, previousStart, previousEnd);

    const changes: Record<string, number> = {};

    Object.keys(current).forEach((key) => {
      const currentValue = current[key as keyof FunnelMetrics];
      const previousValue = previous[key as keyof FunnelMetrics];

      if (typeof currentValue === 'number' && typeof previousValue === 'number') {
        if (previousValue === 0) {
          changes[key] = currentValue > 0 ? 100 : 0;
        } else {
          changes[key] = Math.round(((currentValue - previousValue) / previousValue) * 100 * 10) / 10;
        }
      }
    });

    return { current, previous, changes };
  }
}

export default new QuoteAnalyticsService();
