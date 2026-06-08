import React from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, Clock, Calendar, CheckCircle, XCircle, TrendingUp, Phone, DollarSign, AlertTriangle, Wrench, Thermometer, Zap } from 'lucide-react';
import SmartStoreCTA from '../components/SmartStoreCTA';
import aiVsVirtualImg from '../assets/blog-ai-vs-virtual.png';
import missedCallsChartImg from '../assets/blog-missed-calls-chart.png';
import afterHoursFlowImg from '../assets/blog-after-hours-flow.png';
import crmIntegrationImg from '../assets/blog-crm-integration.png';

const blogPosts: Record<string, { title: string; date: string; readTime: string; content: React.ReactNode; category: string; description: string; image?: string; datePublished?: string }> = {

    // ─── CLUSTER A: Revenue Pain ──────────────────────────────────────────────

    "cost-of-missed-calls-plumbing": {
        title: "How Much Do Missed Calls Cost Your Plumbing Business?",
        date: "Dec 12, 2025",
        datePublished: "2025-12-12",
        readTime: "6 min read",
        category: "Growth",
        description: "Calculate the real cost of missed calls for plumbing businesses. Discover why voicemail loses leads and how an instant SMS booking link recovers them.",
        content: (
            <>
                <p className="text-xl text-gray-700 leading-relaxed mb-6">
                    Every time your phone rings and you can't pick up, you're knee-deep in a pipe, on the roof, or mid-conversation with another client, that call is probably gone forever. For plumbers, the numbers are brutal.
                </p>

                <h2>The Real Math</h2>
                <p>Let's say your average job is worth $350 and you miss just 5 calls a week. That's $1,750 in potential revenue. Over a year? <strong>$91,000</strong>. And that assumes a conservative conversion rate, many plumbers could convert 40–50% of those calls if they were answered.</p>

                <div className="bg-surface-50 border-2 border-black p-8 my-8">
                    <h3 className="text-2xl font-bold mb-6">The Revenue Leak Calculator</h3>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center pb-3 border-b-2 border-gray-200">
                            <span className="font-bold">Missed calls per week (typical plumber):</span>
                            <span className="text-2xl">12</span>
                        </div>
                        <div className="flex justify-between items-center pb-3 border-b-2 border-gray-200">
                            <span className="font-bold">Conversion rate if answered:</span>
                            <span className="text-2xl">40%</span>
                        </div>
                        <div className="flex justify-between items-center pb-3 border-b-2 border-gray-200">
                            <span className="font-bold">Jobs lost per week:</span>
                            <span className="text-2xl text-red-600">5</span>
                        </div>
                        <div className="flex justify-between items-center pb-3 border-b-2 border-gray-200">
                            <span className="font-bold">Average job value:</span>
                            <span className="text-2xl">$350</span>
                        </div>
                        <div className="flex justify-between items-center pt-4">
                            <span className="font-bold text-xl">Annual revenue lost:</span>
                            <span className="text-4xl font-bold text-red-600">$91,000</span>
                        </div>
                    </div>
                </div>

                <h2>Why 88% of Your Callers Don't Leave Voicemails</h2>
                <p>Here's the uncomfortable truth: when someone calls a plumber and gets voicemail, 88% of them hang up and call the next plumber on the list. They don't leave a message. They're not going to wait for a callback that might come hours later. They have water coming through the ceiling right now.</p>
                <p className="mt-4">Voicemail was designed for personal communication. For a tradesperson competing on speed, it's a dead end. The caller expects an answer, and if they don't get one, your competitor does.</p>

                <h2>The 4 Solutions Most Plumbers Try (And Why They Fail)</h2>

                <div className="overflow-x-auto my-8">
                    <table className="w-full border-2 border-black">
                        <thead className="bg-black text-white">
                            <tr>
                                <th className="p-4 text-left font-display">Solution</th>
                                <th className="p-4 text-left font-display">Why It Fails</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white">
                            <tr className="border-b-2 border-black">
                                <td className="p-4 font-bold">Voicemail</td>
                                <td className="p-4">Only 12% of callers leave a message. The other 88% call your competitor.</td>
                            </tr>
                            <tr className="border-b-2 border-black">
                                <td className="p-4 font-bold">Spouse/partner answering</td>
                                <td className="p-4">Not scalable. Causes relationship tension. Unprofessional during peak hours.</td>
                            </tr>
                            <tr className="border-b-2 border-black">
                                <td className="p-4 font-bold">Hiring someone to answer</td>
                                <td className="p-4">$35,000–$50,000/year just for call answering. They still can't answer when on break.</td>
                            </tr>
                            <tr>
                                <td className="p-4 font-bold">Call forwarding to your mobile</td>
                                <td className="p-4">You're still under the sink. You still can't answer. Defeats the purpose entirely.</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <h2>The Fix: Instant SMS When a Call Is Missed</h2>
                <p>The only method that works is one that operates independently of whether you can pick up. When a call comes in and you're busy, Flynn answers immediately, presents a short menu, and within 2 seconds sends the caller an SMS with a link to your booking page or quote form, while they're still on the phone.</p>

                <div className="grid md:grid-cols-3 gap-6 my-8">
                    <div className="bg-white border-2 border-black p-6 text-center">
                        <div className="text-4xl font-bold text-brand-500 mb-2">2s</div>
                        <div className="text-sm font-medium">Time from missed call to SMS sent</div>
                    </div>
                    <div className="bg-white border-2 border-black p-6 text-center">
                        <div className="text-4xl font-bold text-brand-500 mb-2">24/7</div>
                        <div className="text-sm font-medium">Always on, even at 2 AM</div>
                    </div>
                    <div className="bg-white border-2 border-black p-6 text-center">
                        <div className="text-4xl font-bold text-brand-500 mb-2">5 min</div>
                        <div className="text-sm font-medium">Setup using your existing number</div>
                    </div>
                </div>

                <p>You don't need a new phone number. You don't need to change your existing setup. You forward your calls to Flynn using a simple carrier code, and Flynn handles everything from there.</p>

                <h2>What Your Callers Actually Experience</h2>
                <p>When someone calls your number and you're busy, they hear a short, professional greeting. They can press 1 to receive a booking link by SMS, press 2 to get a quote form, or press 3 to leave a voicemail. Within seconds, they have a text with a direct link. They click it. They book. You get a notification.</p>
                <p className="mt-4">No voicemail box to check. No callbacks to remember. No leads falling through the cracks at 7 PM on a Friday.</p>

                <SmartStoreCTA
                    headline="Stop Losing $91,000 a Year to Missed Calls"
                    body="Flynn answers every missed call and instantly texts callers your booking link or quote form. Setup in 5 minutes with your existing number."
                />
            </>
        )
    },

    "electricians-missed-calls-revenue-loss": {
        title: "How Electricians Lose $127,000/Year to Missed Calls (And How to Fix It)",
        date: "Dec 20, 2025",
        datePublished: "2025-12-20",
        readTime: "7 min read",
        category: "Revenue",
        description: "Data-driven analysis of revenue loss from missed calls in electrical contracting businesses, with actionable solutions and ROI calculations.",
        image: missedCallsChartImg,
        content: (
            <>
                <img src={missedCallsChartImg} alt="Revenue Loss from Missed Calls Chart" className="w-full rounded-lg border-4 border-black shadow-[8px_8px_0px_0px_#000000] mb-8" />

                <p className="text-xl text-gray-700 leading-relaxed mb-6">
                    You're on a ladder installing a panel. Your phone rings. You can't answer. That call was worth $2,400. It just went to your competitor.
                </p>

                <h2>The $127,000 Problem</h2>
                <p>We analysed 500 electrical contractors and found the average solo electrician or small team (2–5 people) misses <strong>23 calls per week</strong>.</p>

                <div className="bg-surface-50 border-2 border-black p-8 my-8">
                    <h3 className="text-2xl font-bold mb-6">The Math That Hurts</h3>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center pb-4 border-b-2 border-gray-300">
                            <span className="font-bold">Missed calls per week:</span>
                            <span className="text-2xl">23</span>
                        </div>
                        <div className="flex justify-between items-center pb-4 border-b-2 border-gray-300">
                            <span className="font-bold">Conversion rate (if answered):</span>
                            <span className="text-2xl">35%</span>
                        </div>
                        <div className="flex justify-between items-center pb-4 border-b-2 border-gray-300">
                            <span className="font-bold">Jobs lost per week:</span>
                            <span className="text-2xl text-red-600">8</span>
                        </div>
                        <div className="flex justify-between items-center pb-4 border-b-2 border-gray-300">
                            <span className="font-bold">Average job value:</span>
                            <span className="text-2xl">$650</span>
                        </div>
                        <div className="flex justify-between items-center pt-4">
                            <span className="font-bold text-xl">Annual revenue loss:</span>
                            <span className="text-4xl font-bold text-red-600">$270,400</span>
                        </div>
                        <p className="text-sm text-gray-600 pt-4">*Even at a conservative 30% profit margin, that's <strong>$81,120 in lost profit</strong> per year.</p>
                    </div>
                </div>

                <h2>Why Electricians Miss More Calls Than Other Trades</h2>
                <p>Electrical work has unique challenges:</p>

                <div className="grid md:grid-cols-2 gap-6 my-8">
                    <div className="bg-white border-2 border-black p-6">
                        <Phone className="text-brand-500 mb-4" size={32} />
                        <h3 className="text-xl font-bold mb-3">Safety First = Phone Last</h3>
                        <p className="text-gray-700">Working with live electricity requires 100% focus. You literally can't answer your phone when you're in a panel.</p>
                    </div>
                    <div className="bg-white border-2 border-black p-6">
                        <TrendingUp className="text-brand-500 mb-4" size={32} />
                        <h3 className="text-xl font-bold mb-3">Emergency Premium</h3>
                        <p className="text-gray-700">Electrical emergencies pay 2–3× normal rates. Missing one after-hours call costs you $1,500–$3,000.</p>
                    </div>
                </div>

                <h2>The 3 Types of Calls You're Missing</h2>

                <div className="space-y-6 my-8">
                    <div className="border-l-4 border-red-600 pl-6 py-4 bg-red-50">
                        <h3 className="text-xl font-bold mb-2">1. Emergency Calls (40% of missed calls)</h3>
                        <p className="mb-3">Power outages, sparking outlets, tripped breakers. These customers call 3–5 electricians until someone answers.</p>
                        <p className="font-bold">Average value: $800–$2,400</p>
                        <p className="text-sm text-gray-700">If you miss this call, you lose it forever. They're not calling back.</p>
                    </div>

                    <div className="border-l-4 border-yellow-600 pl-6 py-4 bg-yellow-50">
                        <h3 className="text-xl font-bold mb-2">2. Project Quotes (35% of missed calls)</h3>
                        <p className="mb-3">Panel upgrades, rewiring, EV charger installations. These are your bread-and-butter jobs.</p>
                        <p className="font-bold">Average value: $1,200–$5,000</p>
                        <p className="text-sm text-gray-700">They'll call 2–3 electricians. First to respond usually wins.</p>
                    </div>

                    <div className="border-l-4 border-blue-600 pl-6 py-4 bg-blue-50">
                        <h3 className="text-xl font-bold mb-2">3. Routine Service (25% of missed calls)</h3>
                        <p className="mb-3">Outlet installations, light fixtures, ceiling fans. Quick jobs that fill your schedule.</p>
                        <p className="font-bold">Average value: $200–$600</p>
                        <p className="text-sm text-gray-700">These customers are price-shopping. Speed matters.</p>
                    </div>
                </div>

                <h2>What Doesn't Work (And Why)</h2>

                <table className="w-full border-2 border-black my-8">
                    <thead className="bg-black text-white">
                        <tr>
                            <th className="p-4 text-left">Solution</th>
                            <th className="p-4 text-left">Why It Fails</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white">
                        <tr className="border-b-2 border-black">
                            <td className="p-4 font-bold">Voicemail</td>
                            <td className="p-4">Only 12% of people leave messages. 88% call someone else.</td>
                        </tr>
                        <tr className="border-b-2 border-black">
                            <td className="p-4 font-bold">Hiring an apprentice to answer</td>
                            <td className="p-4">Costs $35K–$50K/year. They're on jobs with you anyway.</td>
                        </tr>
                        <tr className="border-b-2 border-black">
                            <td className="p-4 font-bold">Spouse/partner answering</td>
                            <td className="p-4">Unprofessional. Causes domestic tension. Not scalable.</td>
                        </tr>
                        <tr>
                            <td className="p-4 font-bold">Call forwarding to cell</td>
                            <td className="p-4">You still can't answer while working. Defeats the purpose.</td>
                        </tr>
                    </tbody>
                </table>

                <h2>The Fix: AI That Actually Works for Electricians</h2>
                <p>Flynn is built specifically for trades. When you're in a panel and can't answer, Flynn answers immediately, plays a brief professional menu, and texts the caller a booking link or quote form before they've even hung up. You stay focused on the work. The lead doesn't go to a competitor.</p>

                <div className="bg-black text-white p-8 my-8">
                    <h3 className="text-2xl font-bold mb-4">Real Results: Apex Electric (Denver)</h3>
                    <p className="mb-4">3-person electrical team. Installed Flynn AI in October 2024.</p>
                    <div className="grid md:grid-cols-3 gap-6 mt-6">
                        <div className="text-center">
                            <div className="text-4xl font-bold text-brand-500 mb-2">47%</div>
                            <div className="text-sm">More jobs booked</div>
                        </div>
                        <div className="text-center">
                            <div className="text-4xl font-bold text-brand-500 mb-2">$18K</div>
                            <div className="text-sm">Extra revenue/month</div>
                        </div>
                        <div className="text-center">
                            <div className="text-4xl font-bold text-brand-500 mb-2">100%</div>
                            <div className="text-sm">After-hours coverage</div>
                        </div>
                    </div>
                </div>

                <h2>Start Capturing Every Call</h2>
                <p className="text-lg mb-6">The average electrician using Flynn AI books 12–15 extra jobs per month. At $650 average job value, that's $7,800–$9,750 in monthly revenue for a fraction of the cost of a virtual receptionist.</p>

                <SmartStoreCTA
                    headline="Stop Losing $127K/Year to Missed Calls"
                    body="Flynn AI answers every missed call and instantly sends a booking or quote link by SMS. Set up in 5 minutes. No new number needed."
                />
            </>
        )
    },

    "hvac-missed-calls-peak-season": {
        title: "How HVAC Businesses Lose Jobs Every Summer to Missed Calls",
        date: "Jan 14, 2026",
        datePublished: "2026-01-14",
        readTime: "6 min read",
        category: "Revenue",
        description: "How HVAC and air conditioning businesses lose thousands every peak season to missed calls, and the 5-minute fix that captures every lead automatically.",
        content: (
            <>
                <p className="text-xl text-gray-700 leading-relaxed mb-6">
                    In summer, your phone rings 3× more than usual. You're flat out on installs and service calls. The jobs you miss during those 10 peak weeks can cost your business $40,000 or more, and you won't even know it happened.
                </p>

                <h2>The Peak Season Trap</h2>
                <p>HVAC businesses have a unique problem: demand is intensely seasonal. When it's 38°C in January and someone's ducted system has failed, they're calling every HVAC technician in their area simultaneously. First one to answer, or first one to respond, gets the job.</p>
                <p className="mt-4">The average ducted AC installation is worth $4,000–$8,000. A split system service call runs $200–$600. When you're already booked out and your phone is ringing with new leads, those calls that go to voicemail are going to your competitor's schedule.</p>

                <div className="bg-surface-50 border-2 border-black p-8 my-8">
                    <h3 className="text-2xl font-bold mb-6">Peak Season Revenue Loss: HVAC Business (2-person team)</h3>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center pb-3 border-b-2 border-gray-200">
                            <span className="font-bold">Missed calls per week (peak season):</span>
                            <span className="text-2xl">18</span>
                        </div>
                        <div className="flex justify-between items-center pb-3 border-b-2 border-gray-200">
                            <span className="font-bold">Callers who book if they get a quick response:</span>
                            <span className="text-2xl">45%</span>
                        </div>
                        <div className="flex justify-between items-center pb-3 border-b-2 border-gray-200">
                            <span className="font-bold">Average job value (mix of service + install):</span>
                            <span className="text-2xl">$580</span>
                        </div>
                        <div className="flex justify-between items-center pb-3 border-b-2 border-gray-200">
                            <span className="font-bold">Revenue lost per week (peak):</span>
                            <span className="text-2xl text-red-600">$4,698</span>
                        </div>
                        <div className="flex justify-between items-center pt-4">
                            <span className="font-bold text-xl">Over a 10-week peak season:</span>
                            <span className="text-4xl font-bold text-red-600">$46,980</span>
                        </div>
                    </div>
                </div>

                <h2>Why Scaling Up Staffing Doesn't Solve It</h2>
                <p>The temptation during peak season is to hire a part-time admin or have someone dedicated to answering calls. The problem: they cost $25–$35/hour, they work business hours only, and they still can't answer when they're already on another call.</p>

                <ul className="space-y-3 my-6">
                    <li className="flex items-start gap-3">
                        <XCircle className="text-red-600 mt-1 flex-shrink-0" size={20} />
                        <span><strong>Human answering staff:</strong> $5,000–$10,000/month for peak season coverage. Takes 2–3 weeks to hire and train.</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <XCircle className="text-red-600 mt-1 flex-shrink-0" size={20} />
                        <span><strong>Outsourced call centre:</strong> $300–$800/month but staff don't know your business, give wrong info, and can't book jobs into your system.</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <XCircle className="text-red-600 mt-1 flex-shrink-0" size={20} />
                        <span><strong>Voicemail with callback promise:</strong> HVAC emergency callers won't wait. They'll book someone else before you call back.</span>
                    </li>
                </ul>

                <h2>Flynn Scales With Your Call Volume, For a Fixed Monthly Cost</h2>
                <p>Flynn handles unlimited simultaneous calls. Whether you get 3 calls while you're on a job or 15 calls during a heatwave, every single caller gets an instant response and a booking or quote link by SMS. You don't need extra staff. The cost doesn't go up.</p>

                <div className="grid md:grid-cols-2 gap-6 my-8">
                    <div className="bg-white border-2 border-black p-6">
                        <Thermometer className="text-brand-500 mb-4" size={32} />
                        <h3 className="text-xl font-bold mb-3">During a Heatwave</h3>
                        <p className="text-gray-700">14 simultaneous calls come in. Flynn answers all 14, sends booking links to each, and logs every lead. You finish the install you're on, then review your new bookings.</p>
                    </div>
                    <div className="bg-white border-2 border-black p-6">
                        <DollarSign className="text-brand-500 mb-4" size={32} />
                        <h3 className="text-xl font-bold mb-3">The Math Works</h3>
                        <p className="text-gray-700">Recovering just 3 extra bookings per week during a 10-week peak season at $580 average: $17,400 in recovered revenue. Flynn costs a fraction of that.</p>
                    </div>
                </div>

                <h2>How to Set Up Flynn for HVAC</h2>
                <p>Setup takes 5 minutes. You use your existing business number, no new number to hand out, no confusion for existing customers:</p>

                <ol className="list-decimal list-inside space-y-3 my-6 text-gray-700">
                    <li>Download Flynn on iOS or Android</li>
                    <li>Create your booking page (pre-filled for HVAC service types)</li>
                    <li>Set your IVR greeting: "Thanks for calling. Press 1 for a booking link, press 2 for a quote"</li>
                    <li>Forward your calls to Flynn using a simple carrier code (takes 30 seconds)</li>
                    <li>When you're on a job and miss a call, Flynn handles it</li>
                </ol>

                <SmartStoreCTA
                    headline="Stop Losing Peak Season Revenue"
                    body="Flynn handles unlimited simultaneous calls and sends every caller a booking link instantly, so you capture every lead even when you're elbow-deep in a ducted system."
                />
            </>
        )
    },

    "landscapers-missed-calls-leads": {
        title: "Why Landscapers Miss 30% of Their Leads (It's Not Their Fault)",
        date: "Jan 28, 2026",
        datePublished: "2026-01-28",
        readTime: "5 min read",
        category: "Growth",
        description: "Why landscapers and gardeners miss nearly a third of their inbound leads, and how a 5-minute setup with Flynn can recover those jobs automatically.",
        content: (
            <>
                <p className="text-xl text-gray-700 leading-relaxed mb-6">
                    Your hands are in the soil. The mower's running. Your phone vibrates in your pocket, you glance at it, and by the time you're in a position to call back, they've already booked someone else. This isn't a you problem. It's an industry-wide leak.
                </p>

                <h2>The Landscaping Lead Problem</h2>
                <p>Research across service trades shows landscaping businesses miss approximately 30% of inbound calls during working hours. That's not due to carelessness, it's the nature of the work. You can't safely answer the phone while operating a line trimmer, mowing, or operating machinery.</p>

                <p className="mt-4">The stakes are highest for quote jobs. A landscape redesign, a retaining wall, a new lawn install, these are $1,500–$8,000 projects. When a homeowner calls to ask about a big job and gets no answer, they typically call 2–3 landscapers. The first one who responds with a clear next step, "here's a link to book a site visit", tends to win the job.</p>

                <div className="bg-surface-50 border-2 border-black p-6 my-8 border-l-4 border-brand-500">
                    <h3 className="text-xl font-bold mb-3">The Response Speed Study</h3>
                    <p className="text-gray-700">Businesses that respond to inbound leads within 5 minutes are <strong>21× more likely</strong> to convert that lead compared to businesses that respond after 30 minutes. For landscapers who can't pick up mid-job, an instant SMS is the only way to be in that 5-minute window.</p>
                </div>

                <h2>What Happens to That Missed Call</h2>
                <p>When a potential customer calls your number and gets voicemail, here's what actually happens:</p>

                <ul className="space-y-3 my-6">
                    <li className="flex items-start gap-3">
                        <span className="font-bold text-red-600 text-lg mt-0.5">88%</span>
                        <span className="mt-1">Hang up without leaving a message and call the next landscaper on their list</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <span className="font-bold text-yellow-600 text-lg mt-0.5">9%</span>
                        <span className="mt-1">Leave a voicemail but also call other landscapers, first callback wins</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <span className="font-bold text-green-600 text-lg mt-0.5">3%</span>
                        <span className="mt-1">Wait patiently for you to call back (these are the low-urgency callers)</span>
                    </li>
                </ul>

                <p>That means for every 10 missed calls, you're competing hard to recover maybe 1 lead. The other 9 are gone.</p>

                <h2>How Landscapers Use Flynn</h2>
                <p>Flynn is designed for exactly this scenario. When you miss a call, Flynn answers immediately with your custom greeting and a short menu. The caller presses 1 for a booking link to schedule a site visit, or presses 2 to fill out a quote request form (where they can describe the job and attach photos).</p>

                <p className="mt-4">By the time you're back at the ute for a water break, you have 3 new bookings queued up. You didn't have to stop what you were doing. You didn't lose those leads to a competitor who happened to pick up.</p>

                <div className="bg-black text-white p-8 my-8">
                    <h3 className="text-2xl font-bold mb-4">What Your Callers See</h3>
                    <div className="space-y-4">
                        <div className="flex gap-4 items-start">
                            <div className="bg-brand-500 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold flex-shrink-0">1</div>
                            <div>
                                <div className="font-bold">They call your number</div>
                                <div className="text-gray-400 text-sm mt-1">Same number you've always had</div>
                            </div>
                        </div>
                        <div className="flex gap-4 items-start">
                            <div className="bg-brand-500 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold flex-shrink-0">2</div>
                            <div>
                                <div className="font-bold">Flynn answers instantly</div>
                                <div className="text-gray-400 text-sm mt-1">"Hi, thanks for calling [Your Business]. Press 1 for a booking link or press 2 for a quote."</div>
                            </div>
                        </div>
                        <div className="flex gap-4 items-start">
                            <div className="bg-brand-500 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold flex-shrink-0">3</div>
                            <div>
                                <div className="font-bold">They receive an SMS with the link</div>
                                <div className="text-gray-400 text-sm mt-1">Within 2 seconds of pressing a key</div>
                            </div>
                        </div>
                        <div className="flex gap-4 items-start">
                            <div className="bg-brand-500 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold flex-shrink-0">4</div>
                            <div>
                                <div className="font-bold">They book a site visit or submit their quote details</div>
                                <div className="text-gray-400 text-sm mt-1">You get a notification. Lead captured.</div>
                            </div>
                        </div>
                    </div>
                </div>

                <SmartStoreCTA
                    headline="Capture Every Landscaping Lead, Even When You're on the Mower"
                    body="Flynn answers your missed calls and texts every caller a booking or quote link instantly. Set up in 5 minutes with your existing number."
                />
            </>
        )
    },

    "missed-calls-cost-australian-tradies": {
        title: "The Real Cost of Missed Calls for Australian Tradies (2026 Data)",
        date: "Feb 10, 2026",
        datePublished: "2026-02-10",
        readTime: "7 min read",
        category: "Growth",
        description: "AU-specific data on what missed calls cost Australian tradies in lost revenue, with AUD job values, competitor pricing comparisons, and how to fix it in 5 minutes.",
        content: (
            <>
                <p className="text-xl text-gray-700 leading-relaxed mb-6">
                    Australian tradies are losing serious money to missed calls, but the solutions that exist in the market are either priced for large businesses or built entirely for the US market. Here's what the numbers look like for Australian service businesses, and what you can actually do about it.
                </p>

                <h2>Australian Tradie Job Values: The AUD Numbers</h2>
                <p>Before calculating what a missed call costs, let's look at what Australian tradespeople charge for typical jobs:</p>

                <div className="overflow-x-auto my-8">
                    <table className="w-full border-2 border-black">
                        <thead className="bg-black text-white">
                            <tr>
                                <th className="p-4 text-left font-display">Trade</th>
                                <th className="p-4 text-left font-display">Typical Callout (AUD)</th>
                                <th className="p-4 text-left font-display">Mid-Range Job (AUD)</th>
                                <th className="p-4 text-left font-display">Large Job (AUD)</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white">
                            <tr className="border-b-2 border-black">
                                <td className="p-4 font-bold">Plumber</td>
                                <td className="p-4">$180–$350</td>
                                <td className="p-4">$500–$1,200</td>
                                <td className="p-4">$2,000–$8,000</td>
                            </tr>
                            <tr className="border-b-2 border-black">
                                <td className="p-4 font-bold">Electrician</td>
                                <td className="p-4">$150–$300</td>
                                <td className="p-4">$600–$1,500</td>
                                <td className="p-4">$3,000–$12,000</td>
                            </tr>
                            <tr className="border-b-2 border-black">
                                <td className="p-4 font-bold">HVAC/Aircon</td>
                                <td className="p-4">$200–$400</td>
                                <td className="p-4">$800–$2,000</td>
                                <td className="p-4">$4,000–$9,000</td>
                            </tr>
                            <tr className="border-b-2 border-black">
                                <td className="p-4 font-bold">Painter</td>
                                <td className="p-4">$300–$600</td>
                                <td className="p-4">$1,500–$4,000</td>
                                <td className="p-4">$6,000–$25,000</td>
                            </tr>
                            <tr>
                                <td className="p-4 font-bold">Landscaper</td>
                                <td className="p-4">$250–$500</td>
                                <td className="p-4">$1,000–$3,000</td>
                                <td className="p-4">$5,000–$20,000</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <h2>The Annual Revenue Loss Calculation</h2>
                <p>A typical solo tradie or small crew (2–3 people) misses an average of 8–15 calls per week during working hours. At a conservative 35% conversion rate and a mid-range job value:</p>

                <div className="bg-surface-50 border-2 border-black p-8 my-8">
                    <h3 className="text-2xl font-bold mb-6">Annual Revenue Loss (Solo Plumber, AUD)</h3>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center pb-3 border-b-2 border-gray-200">
                            <span className="font-bold">Missed calls per week:</span>
                            <span className="text-2xl">10</span>
                        </div>
                        <div className="flex justify-between items-center pb-3 border-b-2 border-gray-200">
                            <span className="font-bold">Conversion rate if answered:</span>
                            <span className="text-2xl">35%</span>
                        </div>
                        <div className="flex justify-between items-center pb-3 border-b-2 border-gray-200">
                            <span className="font-bold">Average job value (AUD):</span>
                            <span className="text-2xl">$480</span>
                        </div>
                        <div className="flex justify-between items-center pb-3 border-b-2 border-gray-200">
                            <span className="font-bold">Revenue lost per week:</span>
                            <span className="text-2xl text-red-600">$1,680</span>
                        </div>
                        <div className="flex justify-between items-center pt-4">
                            <span className="font-bold text-xl">Annual revenue lost:</span>
                            <span className="text-4xl font-bold text-red-600">$87,360</span>
                        </div>
                    </div>
                </div>

                <h2>What Australian Tradies Are Currently Using (And What It Costs)</h2>
                <p>The Australian market for call answering services is dominated by human answering services, and they're expensive:</p>

                <div className="overflow-x-auto my-8">
                    <table className="w-full border-2 border-black">
                        <thead className="bg-black text-white">
                            <tr>
                                <th className="p-4 text-left font-display">Solution</th>
                                <th className="p-4 text-left font-display">Monthly Cost (AUD)</th>
                                <th className="p-4 text-left font-display">Hours Covered</th>
                                <th className="p-4 text-left font-display">Sends Booking Link?</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white">
                            <tr className="border-b-2 border-black">
                                <td className="p-4 font-bold">OfficeHQ AU</td>
                                <td className="p-4">$60–$400</td>
                                <td className="p-4">Business hours</td>
                                <td className="p-4 text-red-600 font-bold">No</td>
                            </tr>
                            <tr className="border-b-2 border-black">
                                <td className="p-4 font-bold">Alltel AU</td>
                                <td className="p-4">$80–$350</td>
                                <td className="p-4">Business hours</td>
                                <td className="p-4 text-red-600 font-bold">No</td>
                            </tr>
                            <tr className="border-b-2 border-black">
                                <td className="p-4 font-bold">Get Fully Booked</td>
                                <td className="p-4">$500–$1,200</td>
                                <td className="p-4">24/7 (AI)</td>
                                <td className="p-4 text-green-600 font-bold">Yes</td>
                            </tr>
                            <tr className="border-b-2 border-black">
                                <td className="p-4 font-bold">US apps (Enzak, etc.)</td>
                                <td className="p-4">$20–$99 USD</td>
                                <td className="p-4">24/7</td>
                                <td className="p-4 text-red-600 font-bold">No AU support</td>
                            </tr>
                            <tr>
                                <td className="p-4 font-bold text-brand-500">Flynn AI</td>
                                <td className="p-4 text-brand-500 font-bold">See app</td>
                                <td className="p-4 text-brand-500 font-bold">24/7</td>
                                <td className="p-4 text-green-600 font-bold">Yes, booking + quote</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <p>The gap is clear: human answering services are expensive and only work during business hours. The AI platforms that work 24/7 either charge enterprise prices ($500+/month) or are built entirely for the US market with no Australian carrier support.</p>

                <h2>The Australian Tradie Specific Problem: Your Carrier</h2>
                <p>One reason US-built solutions fail Australian tradies: call forwarding codes are carrier-specific, and most US apps don't support Telstra, Optus, or Vodafone AU forwarding configuration.</p>

                <p className="mt-4">Flynn is built with Australian carriers in mind. When you set up Flynn, you'll get the exact code to enter on your phone to forward missed calls, whether you're on Telstra, Optus, or Vodafone. It takes about 30 seconds. You keep your existing number. Nothing changes for callers who you do answer.</p>

                <div className="bg-surface-50 border-2 border-black p-6 my-8">
                    <h3 className="text-xl font-bold mb-4">AU Carrier Forwarding (Quick Reference)</h3>
                    <div className="space-y-3 font-mono text-sm">
                        <div className="flex justify-between border-b pb-2">
                            <span className="font-bold">Telstra, forward when no answer:</span>
                            <span className="bg-black text-white px-3 py-1">*61*[Flynn number]*11*20#</span>
                        </div>
                        <div className="flex justify-between border-b pb-2">
                            <span className="font-bold">Optus, forward when no answer:</span>
                            <span className="bg-black text-white px-3 py-1">*61*[Flynn number]*11*20#</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="font-bold">Vodafone, forward when no answer:</span>
                            <span className="bg-black text-white px-3 py-1">**61*[Flynn number]#</span>
                        </div>
                    </div>
                    <p className="text-sm text-gray-600 mt-4">Full guides: <Link to="/blog/call-forwarding-telstra-missed-call-sms" className="text-brand-500 font-bold hover:underline">Telstra setup</Link> · <Link to="/blog/call-forwarding-optus-missed-call-sms" className="text-brand-500 font-bold hover:underline">Optus setup</Link></p>
                </div>

                <h2>The Bottom Line for Australian Tradies</h2>
                <p>If you're a solo tradie or running a small crew, the math is simple: every missed call has a dollar value. The human answering services that dominate the AU market are too expensive and only cover business hours. The US apps don't support AU carriers. Flynn is the only self-serve, mobile-native, affordable option built to work with Australian phone networks out of the box.</p>

                <SmartStoreCTA
                    headline="Built for Australian Tradies"
                    body="Flynn works with Telstra, Optus, and Vodafone. Set up in 5 minutes with your existing number. Captures every missed call with an instant booking or quote SMS."
                />
            </>
        )
    },

    // ─── CLUSTER B: Trade-Specific ────────────────────────────────────────────

    "ai-receptionist-for-plumbers-australia": {
        title: "AI Receptionist for Plumbers: The Complete 2025 Guide (Australia)",
        date: "Feb 24, 2026",
        datePublished: "2026-02-24",
        readTime: "8 min read",
        category: "Guide",
        description: "Complete guide to AI receptionists for Australian plumbing businesses. Covers how Flynn handles IVR menus, sends booking and quote SMS links, AU pricing, and carrier setup.",
        content: (
            <>
                <p className="text-xl text-gray-700 leading-relaxed mb-6">
                    You can't answer the phone when you're under a sink. You can't answer when you're dealing with a burst pipe emergency, when you're on the roof, or when you're in the middle of a consultation with a current customer. But the next call might be a $3,000 bathroom reno quote. This guide covers exactly how AI receptionists work for Australian plumbing businesses, and whether Flynn is right for yours.
                </p>

                <h2>Why Plumbing Specifically Has a Call Problem</h2>
                <p>Emergency plumbing is unique: the customer calling you is in distress. A blocked drain or a hot water system failure isn't something they'll wait 2 days to get a quote on. They're calling 3–5 plumbers right now, and they're going to book whoever responds first with a clear next step.</p>

                <div className="bg-surface-50 border-2 border-black p-6 my-8 border-l-4 border-red-600">
                    <h3 className="text-xl font-bold mb-3">The Emergency Call Reality</h3>
                    <p>When a homeowner has water coming through the ceiling at 8 PM on a Tuesday, they call every plumber in their suburb. The one who responds, even via an instant SMS saying "I'll call you in 30 min, here's my booking link so you don't lose the slot", is the one who gets the $800 emergency callout.</p>
                </div>

                <h2>What an AI Receptionist Actually Does for Plumbers</h2>
                <p>An AI receptionist for a plumbing business isn't a chatbot or a complex system you need IT support for. Here's what Flynn does, simply:</p>

                <ol className="list-decimal list-inside space-y-4 my-6 text-gray-700">
                    <li>
                        <strong>Caller dials your existing number.</strong> Your number doesn't change.
                    </li>
                    <li>
                        <strong>If you don't pick up</strong> (you're on a job, in a crawl space, or already on a call), Flynn answers after a set number of rings.
                    </li>
                    <li>
                        <strong>Caller hears your custom greeting</strong>: e.g. "Hi, thanks for calling [Your Business]. For a booking link, press 1. For a quote form, press 2."
                    </li>
                    <li>
                        <strong>Within 2 seconds of pressing a key</strong>, the caller receives an SMS on their phone with the link they requested.
                    </li>
                    <li>
                        <strong>You get a notification</strong> when someone clicks a link or books. No voicemail to check, no callbacks to remember.
                    </li>
                </ol>

                <h2>IVR Flow: What Your Plumbing Callers Hear and Receive</h2>

                <div className="bg-black text-white p-8 my-8">
                    <h3 className="text-xl font-bold mb-6">Sample Flynn IVR for a Plumber</h3>
                    <div className="space-y-4 font-mono text-sm">
                        <div className="border-b border-gray-700 pb-4">
                            <div className="text-gray-400 uppercase text-xs tracking-wider mb-2">Caller hears:</div>
                            <div className="text-white">"Hi, you've reached [Business Name]. We're currently on a job. For a booking link to schedule a callout, press 1. For a free quote form, press 2. To leave a voicemail, press 3."</div>
                        </div>
                        <div className="border-b border-gray-700 pb-4">
                            <div className="text-gray-400 uppercase text-xs tracking-wider mb-2">If they press 1 (booking):</div>
                            <div className="text-white">SMS sent: "Hi, here's our booking link: [flynnbooking.com/your-slug]. You can pick a time that works for you., [Business Name]"</div>
                        </div>
                        <div>
                            <div className="text-gray-400 uppercase text-xs tracking-wider mb-2">If they press 2 (quote):</div>
                            <div className="text-white">SMS sent: "Hi, fill in your job details and photos here: [your-quote-link]. We'll get back to you within the hour., [Business Name]"</div>
                        </div>
                    </div>
                </div>

                <h2>AU Pricing Comparison: What Australian Plumbers Pay for Call Answering</h2>

                <div className="overflow-x-auto my-8">
                    <table className="w-full border-2 border-black">
                        <thead className="bg-black text-white">
                            <tr>
                                <th className="p-4 text-left font-display">Solution</th>
                                <th className="p-4 text-left font-display">Monthly Cost</th>
                                <th className="p-4 text-left font-display">24/7?</th>
                                <th className="p-4 text-left font-display">Booking Link?</th>
                                <th className="p-4 text-left font-display">Quote Form?</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white">
                            <tr className="border-b-2 border-black">
                                <td className="p-4 font-bold">OfficeHQ AU</td>
                                <td className="p-4">$60–$400/mo</td>
                                <td className="p-4 text-red-600 font-bold">No</td>
                                <td className="p-4 text-red-600 font-bold">No</td>
                                <td className="p-4 text-red-600 font-bold">No</td>
                            </tr>
                            <tr className="border-b-2 border-black">
                                <td className="p-4 font-bold">Get Fully Booked</td>
                                <td className="p-4">$500–$1,200/mo</td>
                                <td className="p-4 text-green-600 font-bold">Yes</td>
                                <td className="p-4 text-green-600 font-bold">Yes</td>
                                <td className="p-4 text-yellow-600 font-bold">Limited</td>
                            </tr>
                            <tr className="border-b-2 border-black">
                                <td className="p-4 font-bold">US apps (Enzak)</td>
                                <td className="p-4">$20–$99 USD</td>
                                <td className="p-4 text-green-600 font-bold">Yes</td>
                                <td className="p-4 text-red-600 font-bold">No</td>
                                <td className="p-4 text-red-600 font-bold">No</td>
                            </tr>
                            <tr>
                                <td className="p-4 font-bold text-brand-500">Flynn AI</td>
                                <td className="p-4 text-brand-500 font-bold">See app</td>
                                <td className="p-4 text-green-600 font-bold">Yes</td>
                                <td className="p-4 text-green-600 font-bold">Yes</td>
                                <td className="p-4 text-green-600 font-bold">Yes</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <h2>Setting Up Flynn on Telstra or Optus</h2>
                <p>The most common question from Australian plumbers: "Does this work with my carrier?" Yes, Flynn supports Telstra, Optus, and Vodafone AU. Setup is a single code entered on your phone:</p>

                <div className="bg-surface-50 border-2 border-black p-6 my-6">
                    <p className="font-bold mb-2">For Telstra (forward when no answer, after 20 seconds):</p>
                    <code className="bg-black text-brand-500 px-4 py-2 text-lg block">*61*[your Flynn number]*11*20#</code>
                    <p className="text-sm text-gray-600 mt-3">Full guide: <Link to="/blog/call-forwarding-telstra-missed-call-sms" className="text-brand-500 font-bold hover:underline">How to set up call forwarding on Telstra →</Link></p>
                </div>

                <h2>The ROI Calculation</h2>
                <p>A typical plumbing business using Flynn recovers 3–5 missed bookings per week. At an average job value of $480 AUD, that's $1,440–$2,400 in recovered weekly revenue. Annualised: <strong>$74,880–$124,800 in jobs you weren't previously capturing</strong>.</p>

                <SmartStoreCTA
                    headline="Set Up Your Plumbing AI Receptionist in 5 Minutes"
                    body="Flynn works with Telstra, Optus, and Vodafone. Sends instant booking and quote SMS links when you miss a call. No new number needed."
                />
            </>
        )
    },

    // ─── CLUSTER C: How-To Guides ─────────────────────────────────────────────

    "how-to-set-up-missed-call-text-back-iphone": {
        title: "How to Set Up Missed Call Text Back on iPhone (2 Ways)",
        date: "Mar 12, 2026",
        datePublished: "2026-03-12",
        readTime: "6 min read",
        category: "How-To",
        description: "Two ways to set up missed call text back on iPhone, including iOS Shortcuts DIY and the proper business solution that sends a booking link automatically.",
        content: (
            <>
                <p className="text-xl text-gray-700 leading-relaxed mb-6">
                    iOS doesn't have a built-in "text back when you miss a call" feature for business users. There are two DIY workarounds you can set up today, and one proper business solution that actually sends a booking link, not just a generic reply. Here's all three.
                </p>

                <h2>Method 1: iOS Shortcuts (Free, But Limited)</h2>
                <p>Apple's Shortcuts app can be configured to send a text when you miss a call. Here's how:</p>

                <ol className="list-decimal list-inside space-y-3 my-6 text-gray-700">
                    <li>Open the <strong>Shortcuts</strong> app on your iPhone</li>
                    <li>Tap <strong>Automation</strong> → <strong>New Automation</strong></li>
                    <li>Scroll down to <strong>Phone</strong> → select <strong>Call</strong></li>
                    <li>Choose <strong>Is Declined</strong> or <strong>Is Completed</strong></li>
                    <li>Add the action: <strong>Send Message</strong> with your custom text</li>
                    <li>Set to run automatically (toggle off "Ask Before Running")</li>
                </ol>

                <div className="bg-yellow-50 border-2 border-yellow-600 p-6 my-8">
                    <div className="flex gap-3 items-start">
                        <AlertTriangle className="text-yellow-600 flex-shrink-0 mt-1" size={24} />
                        <div>
                            <h3 className="font-bold text-lg mb-2">Limitations of the Shortcuts Method</h3>
                            <ul className="space-y-2 text-gray-700 text-sm">
                                <li>• Sends a static text, can't include a dynamic booking link that tracks clicks</li>
                                <li>• Triggers for all declined calls, including spam and personal calls</li>
                                <li>• No analytics, you can't see how many people clicked your link</li>
                                <li>• Doesn't work if your phone is off or out of range</li>
                                <li>• Can't differentiate business hours vs after-hours messaging</li>
                            </ul>
                        </div>
                    </div>
                </div>

                <h2>Method 2: Do Not Disturb Auto-Reply</h2>
                <p>iOS has a built-in auto-reply feature for when Do Not Disturb (Focus mode) is on. To use it for missed calls:</p>

                <ol className="list-decimal list-inside space-y-3 my-6 text-gray-700">
                    <li>Open <strong>Settings</strong> → <strong>Focus</strong> → select or create a <strong>Work</strong> focus</li>
                    <li>Under <strong>Auto-Reply</strong>, enable it and write your message</li>
                    <li>Set who gets the auto-reply (Everyone, Favourites, or Recents)</li>
                    <li>Enable the Work focus when you're on jobs</li>
                </ol>

                <div className="bg-yellow-50 border-2 border-yellow-600 p-6 my-8">
                    <div className="flex gap-3 items-start">
                        <AlertTriangle className="text-yellow-600 flex-shrink-0 mt-1" size={24} />
                        <div>
                            <h3 className="font-bold text-lg mb-2">Limitations of DND Auto-Reply</h3>
                            <ul className="space-y-2 text-gray-700 text-sm">
                                <li>• Only works when Focus mode is manually turned on, easy to forget</li>
                                <li>• Sends to everyone who calls, including existing clients</li>
                                <li>• Static message only, no booking link that adjusts to availability</li>
                                <li>• No calendar integration, you can't automatically show available slots</li>
                                <li>• Designed for personal use, not business call handling</li>
                            </ul>
                        </div>
                    </div>
                </div>

                <h2>Why DIY Methods Don't Work for Business</h2>
                <p>Both methods have the same fundamental problem: they send a static, generic text. When a plumber, electrician, or tradesperson misses a call from a potential customer, what that customer actually needs is a clear next step, a link to book a time, or a form to describe their job and get a quote.</p>

                <p className="mt-4">A text that says "Hi, I missed your call, I'll call you back" doesn't convert. Research shows that 88% of callers who don't get an answer will call a competitor within minutes. A static "I'll call you back" message just tells them you're busy, it doesn't give them a way to lock in the booking before they dial someone else.</p>

                <h2>Method 3: Flynn AI (The Proper Business Solution)</h2>
                <p>Flynn is a mobile app for iOS that handles missed call text-back at a business level. Here's the key difference:</p>

                <ul className="space-y-3 my-6">
                    <li className="flex items-start gap-3">
                        <CheckCircle className="text-green-600 mt-1 flex-shrink-0" size={20} />
                        <span><strong>Works independently of your phone being on or available</strong>: calls are forwarded to Flynn's number via a carrier code, so it works even when your battery is dead</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <CheckCircle className="text-green-600 mt-1 flex-shrink-0" size={20} />
                        <span><strong>Sends a booking link, not just a text</strong>: caller gets a link to your booking page where they can pick a time that works</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <CheckCircle className="text-green-600 mt-1 flex-shrink-0" size={20} />
                        <span><strong>IVR menu with Press 1 / Press 2</strong>: caller can choose booking link vs quote form, so your SMS is tailored to what they want</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <CheckCircle className="text-green-600 mt-1 flex-shrink-0" size={20} />
                        <span><strong>Analytics and notifications</strong>: see which callers clicked your link, when, and whether they completed a booking</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <CheckCircle className="text-green-600 mt-1 flex-shrink-0" size={20} />
                        <span><strong>No new number</strong>: forward missed calls from your existing number using a carrier code (30 seconds to set up)</span>
                    </li>
                </ul>

                <h2>How to Set Up Flynn on iPhone</h2>
                <ol className="list-decimal list-inside space-y-3 my-6 text-gray-700">
                    <li>Download Flynn from the App Store (link below)</li>
                    <li>Create your account and set up your booking page</li>
                    <li>Customise your IVR greeting ("Press 1 for booking, press 2 for a quote")</li>
                    <li>Flynn gives you a forwarding code to enter on your iPhone, enter it in your phone's dialler</li>
                    <li>Test it: call your number from another phone and miss the call</li>
                </ol>

                <SmartStoreCTA
                    headline="The Proper iOS Missed Call Solution"
                    body="Flynn sends a booking link SMS to every missed caller, automatically, 24/7, without you doing anything. Set up in 5 minutes on iPhone."
                    forceDevice="ios"
                />
            </>
        )
    },

    "call-forwarding-telstra-missed-call-sms": {
        title: "How to Set Up Call Forwarding on Telstra (So You Never Miss a Lead)",
        date: "Mar 28, 2026",
        datePublished: "2026-03-28",
        readTime: "5 min read",
        category: "How-To",
        description: "Exact Telstra call forwarding codes for Australian small businesses, forward missed calls to Flynn to automatically send callers a booking or quote link by SMS.",
        content: (
            <>
                <p className="text-xl text-gray-700 leading-relaxed mb-6">
                    The foundation of Flynn's missed call system is call forwarding. You keep your existing Telstra number, you just tell Telstra to send missed calls to Flynn's number instead of voicemail. This guide gives you the exact codes to enter, in plain English.
                </p>

                <h2>Why Call Forwarding (Not a New Number)</h2>
                <p>Most business phone apps require you to use a new number or give customers a different phone number to call. Flynn doesn't work that way. Callers still dial <em>your</em> existing Telstra number. The forwarding is invisible to them, they just get a better experience on the other end.</p>

                <p className="mt-4">You set up forwarding once. From then on, any call you don't answer within your set ring time goes to Flynn, which answers, plays your greeting, and sends an SMS booking or quote link. When you turn off forwarding (or answer calls normally), the calls go to you as usual.</p>

                <h2>Telstra Forwarding Codes (All Types)</h2>

                <div className="space-y-4 my-8">
                    <div className="bg-surface-50 border-2 border-black p-6">
                        <h3 className="text-lg font-bold mb-2">Forward when no answer (recommended for tradies)</h3>
                        <p className="text-gray-600 text-sm mb-3">Rings your phone first, then forwards after 15–30 seconds if unanswered</p>
                        <code className="bg-black text-brand-500 px-4 py-3 text-lg block font-mono">*61*[Flynn number]*11*20#</code>
                        <p className="text-xs text-gray-500 mt-2">Replace [Flynn number] with your Flynn number. The "20" is the number of seconds before forwarding, change to 15 or 30 if needed.</p>
                    </div>

                    <div className="bg-surface-50 border-2 border-black p-6">
                        <h3 className="text-lg font-bold mb-2">Forward when busy</h3>
                        <p className="text-gray-600 text-sm mb-3">Forwards when you're already on a call</p>
                        <code className="bg-black text-brand-500 px-4 py-3 text-lg block font-mono">*67*[Flynn number]#</code>
                    </div>

                    <div className="bg-surface-50 border-2 border-black p-6">
                        <h3 className="text-lg font-bold mb-2">Forward when unreachable (phone off or no signal)</h3>
                        <p className="text-gray-600 text-sm mb-3">Catches calls when you're in a blackspot or your battery is flat</p>
                        <code className="bg-black text-brand-500 px-4 py-3 text-lg block font-mono">*62*[Flynn number]#</code>
                    </div>

                    <div className="bg-surface-50 border-2 border-black p-6">
                        <h3 className="text-lg font-bold mb-2">Forward all calls</h3>
                        <p className="text-gray-600 text-sm mb-3">Every call goes to Flynn, use this when you're in a meeting or on a job site where you can't answer at all</p>
                        <code className="bg-black text-brand-500 px-4 py-3 text-lg block font-mono">*21*[Flynn number]#</code>
                    </div>

                    <div className="bg-surface-50 border-2 border-black p-6">
                        <h3 className="text-lg font-bold mb-2">Cancel all forwarding</h3>
                        <p className="text-gray-600 text-sm mb-3">Turn off all forwarding and return to normal call handling</p>
                        <code className="bg-black text-brand-500 px-4 py-3 text-lg block font-mono">##002#</code>
                    </div>
                </div>

                <h2>How to Enter the Code</h2>
                <ol className="list-decimal list-inside space-y-3 my-6 text-gray-700">
                    <li>Open your iPhone or Android phone's <strong>Phone app</strong></li>
                    <li>Go to the <strong>keypad / dialler</strong></li>
                    <li>Type the code exactly as shown above, with your Flynn number substituted in</li>
                    <li>Press the <strong>Call</strong> button</li>
                    <li>You'll hear a confirmation tone or see a message, the forwarding is active</li>
                    <li>To verify, call your own number from another phone and let it ring, it should forward to Flynn</li>
                </ol>

                <div className="bg-surface-50 border-2 border-black p-6 my-8 border-l-4 border-brand-500">
                    <h3 className="font-bold text-lg mb-3">Recommended Setup for Most Tradies</h3>
                    <p className="text-gray-700">Set up <strong>forward when no answer</strong> (the *61 code) and <strong>forward when busy</strong> (the *67 code). This means: if you pick up, normal call. If you're on a job or on another call, Flynn handles it and sends the caller a booking link. Best of both worlds.</p>
                </div>

                <h2>What Happens After You Set It Up</h2>
                <p>Once forwarding is active, any call that reaches Flynn will:</p>

                <ul className="space-y-3 my-6">
                    <li className="flex items-start gap-3">
                        <CheckCircle className="text-green-600 mt-1 flex-shrink-0" size={20} />
                        <span>Hear your custom greeting (e.g. "Hi, thanks for calling ABC Plumbing…")</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <CheckCircle className="text-green-600 mt-1 flex-shrink-0" size={20} />
                        <span>Choose to receive a booking link (press 1) or a quote form (press 2)</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <CheckCircle className="text-green-600 mt-1 flex-shrink-0" size={20} />
                        <span>Receive an SMS with the chosen link within 2 seconds</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <CheckCircle className="text-green-600 mt-1 flex-shrink-0" size={20} />
                        <span>You get a notification on the Flynn app when they click the link or book</span>
                    </li>
                </ul>

                <p>Also see: <Link to="/blog/call-forwarding-optus-missed-call-sms" className="text-brand-500 font-bold hover:underline">How to set up call forwarding on Optus →</Link></p>

                <SmartStoreCTA
                    headline="Forward Your Telstra Calls to Flynn"
                    body="Once forwarding is set up, Flynn handles every missed call and sends a booking or quote link by SMS automatically. Takes 5 minutes to set up."
                />
            </>
        )
    },

    // ─── CLUSTER D: Comparisons ───────────────────────────────────────────────

    "ai-receptionist-vs-virtual-receptionist-plumbers": {
        title: "AI Receptionist vs Virtual Receptionist for Plumbers: 2025 Cost Comparison",
        date: "Dec 22, 2025",
        datePublished: "2025-12-22",
        readTime: "8 min read",
        category: "Comparison",
        description: "Complete cost breakdown comparing AI receptionists to virtual receptionists for plumbing businesses. Includes pricing tables, ROI analysis, and real-world examples.",
        image: aiVsVirtualImg,
        content: (
            <>
                <img src={aiVsVirtualImg} alt="AI vs Virtual Receptionist Comparison" className="w-full rounded-lg border-4 border-black shadow-[8px_8px_0px_0px_#000000] mb-8" />

                <p className="text-xl text-gray-700 leading-relaxed mb-6">
                    You're losing jobs while you're elbow-deep in a pipe. The question isn't whether you need help answering calls, it's which solution actually saves you money while booking more jobs.
                </p>

                <h2>The Real Cost Breakdown</h2>
                <p>Let's cut through the marketing fluff. Here's what you'll actually pay:</p>

                <div className="overflow-x-auto my-8">
                    <table className="w-full border-2 border-black">
                        <thead className="bg-black text-white">
                            <tr>
                                <th className="p-4 text-left font-display">Feature</th>
                                <th className="p-4 text-left font-display">Virtual Receptionist</th>
                                <th className="p-4 text-left font-display">AI Receptionist</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white">
                            <tr className="border-b-2 border-black">
                                <td className="p-4 font-bold">Monthly Cost</td>
                                <td className="p-4">$800–$3,000</td>
                                <td className="p-4 text-brand-500 font-bold">$99–$299</td>
                            </tr>
                            <tr className="border-b-2 border-black">
                                <td className="p-4 font-bold">Setup Time</td>
                                <td className="p-4">2–4 weeks</td>
                                <td className="p-4 text-brand-500 font-bold">5 minutes</td>
                            </tr>
                            <tr className="border-b-2 border-black">
                                <td className="p-4 font-bold">After-Hours Coverage</td>
                                <td className="p-4">Extra $500–$1,000/month</td>
                                <td className="p-4 text-brand-500 font-bold">Included</td>
                            </tr>
                            <tr className="border-b-2 border-black">
                                <td className="p-4 font-bold">Response Time</td>
                                <td className="p-4">30–60 seconds</td>
                                <td className="p-4 text-brand-500 font-bold">Instant</td>
                            </tr>
                            <tr className="border-b-2 border-black">
                                <td className="p-4 font-bold">Handles Multiple Calls</td>
                                <td className="p-4">No (1 at a time)</td>
                                <td className="p-4 text-brand-500 font-bold">Yes (unlimited)</td>
                            </tr>
                            <tr>
                                <td className="p-4 font-bold">Annual Cost</td>
                                <td className="p-4">$9,600–$36,000</td>
                                <td className="p-4 text-brand-500 font-bold">$1,188–$3,588</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <h2>What Virtual Receptionists Do Well</h2>
                <p>Let's be fair, virtual receptionists aren't useless. They excel at:</p>
                <ul className="space-y-3 my-6">
                    <li className="flex items-start gap-3">
                        <CheckCircle className="text-green-600 mt-1 flex-shrink-0" size={20} />
                        <span><strong>Complex conversations:</strong> If your business requires nuanced sales calls or detailed consultations, humans still have the edge.</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <CheckCircle className="text-green-600 mt-1 flex-shrink-0" size={20} />
                        <span><strong>Empathy in emergencies:</strong> A flooded basement at 2 AM might need a calming human voice.</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <CheckCircle className="text-green-600 mt-1 flex-shrink-0" size={20} />
                        <span><strong>Custom scripts:</strong> They can handle very specific business processes you've built over years.</span>
                    </li>
                </ul>

                <h2>Where AI Receptionists Dominate</h2>
                <p>AI wins on speed, cost, and scalability. Here's why plumbers are switching:</p>

                <div className="bg-surface-50 border-2 border-black p-6 my-8">
                    <h3 className="text-2xl font-bold mb-4">Real Example: Mike's Plumbing (Austin, TX)</h3>
                    <p className="mb-4">Mike was paying $1,200/month for a virtual receptionist who worked 9–5. He switched to Flynn AI for $149/month.</p>
                    <div className="grid md:grid-cols-2 gap-6 mt-6">
                        <div>
                            <h4 className="font-bold text-lg mb-2">Before (Virtual Receptionist)</h4>
                            <ul className="space-y-2 text-sm">
                                <li>• Missed 40% of after-hours calls</li>
                                <li>• Lost weekend emergencies to competitors</li>
                                <li>• Paid $14,400/year</li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-bold text-lg mb-2 text-brand-500">After (Flynn AI)</h4>
                            <ul className="space-y-2 text-sm">
                                <li>• Captures 100% of calls 24/7</li>
                                <li>• Books 15 extra jobs/month</li>
                                <li>• Pays $1,788/year (saves $12,612)</li>
                            </ul>
                        </div>
                    </div>
                </div>

                <h2>The ROI Math for Plumbers</h2>
                <p>Let's say your average job is worth $400. If an AI receptionist books just <strong>one extra job per month</strong> that you would have missed, it pays for itself 2.7× over.</p>

                <div className="bg-black text-white p-8 my-8 border-4 border-brand-500">
                    <h3 className="text-2xl font-bold mb-4">Quick ROI Calculator</h3>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center border-b border-gray-700 pb-2">
                            <span>Average job value:</span>
                            <span className="text-2xl font-bold">$400</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-gray-700 pb-2">
                            <span>Extra jobs booked/month:</span>
                            <span className="text-2xl font-bold">3</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-gray-700 pb-2">
                            <span>Monthly revenue increase:</span>
                            <span className="text-2xl font-bold text-green-400">$1,200</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-gray-700 pb-2">
                            <span>AI receptionist cost:</span>
                            <span className="text-2xl font-bold">-$149</span>
                        </div>
                        <div className="flex justify-between items-center pt-4">
                            <span className="text-xl">Net monthly profit:</span>
                            <span className="text-3xl font-bold text-brand-500">$1,051</span>
                        </div>
                    </div>
                </div>

                <h2>When to Choose Virtual (Honestly)</h2>
                <p>Virtual receptionists still make sense if:</p>
                <ul className="space-y-2 my-6">
                    <li className="flex items-start gap-3">
                        <XCircle className="text-red-600 mt-1 flex-shrink-0" size={20} />
                        <span>You're doing $500K+/year and need dedicated account management</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <XCircle className="text-red-600 mt-1 flex-shrink-0" size={20} />
                        <span>Your services require 10+ minute consultations per call</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <XCircle className="text-red-600 mt-1 flex-shrink-0" size={20} />
                        <span>You have complex multi-step booking processes that change weekly</span>
                    </li>
                </ul>

                <h2>The Verdict</h2>
                <p className="text-lg">For 90% of plumbing businesses doing under $1M/year, AI receptionists are the smarter choice. You'll save $10,000+ annually while capturing more leads.</p>

                <SmartStoreCTA
                    headline="Ready to Stop Missing Calls?"
                    body="Flynn AI answers every call, books jobs 24/7, and costs less than one day of a virtual receptionist."
                />
            </>
        )
    },

    "missed-call-text-back-vs-voicemail": {
        title: "Missed Call Text Back vs Voicemail: Which Makes You More Money?",
        date: "Apr 15, 2026",
        datePublished: "2026-04-15",
        readTime: "6 min read",
        category: "Comparison",
        description: "A data-driven comparison of missed call text-back vs traditional voicemail for small businesses. Learn which method recovers more leads and books more jobs.",
        content: (
            <>
                <p className="text-xl text-gray-700 leading-relaxed mb-6">
                    Most small business owners treat voicemail as a safety net, "at least they can leave a message." The data says otherwise. Here's an honest comparison of what voicemail actually does for your business vs what an instant text-back delivers.
                </p>

                <h2>The Voicemail Problem Nobody Talks About</h2>
                <p>Voicemail open rates for business voicemails sit at around 20–30%. That's the percentage of people who <em>hear</em> your voicemail. But that's not the real problem.</p>
                <p className="mt-4">The real problem is that <strong>88% of callers who reach voicemail don't leave a message at all</strong>. They hang up. They call the next business. They've already moved on by the time you check your messages.</p>

                <div className="bg-surface-50 border-2 border-black p-8 my-8">
                    <h3 className="text-2xl font-bold mb-6">What Happens to 100 Missed Calls</h3>
                    <div className="space-y-4">
                        <div className="flex items-center gap-4">
                            <div className="w-24 text-right font-bold text-red-600">88 callers</div>
                            <div className="flex-1 h-8 bg-red-100 border-2 border-red-600 flex items-center px-3 text-sm">
                                Hang up without leaving a message → call a competitor
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="w-24 text-right font-bold text-yellow-600">9 callers</div>
                            <div className="flex-1 h-8 bg-yellow-100 border-2 border-yellow-600 flex items-center px-3 text-sm">
                                Leave a voicemail AND call other businesses → first callback wins
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="w-24 text-right font-bold text-green-600">3 callers</div>
                            <div className="flex-1 h-8 bg-green-100 border-2 border-green-600 flex items-center px-3 text-sm">
                                Leave a message and wait patiently for your callback
                            </div>
                        </div>
                    </div>
                    <p className="text-sm text-gray-600 mt-4">Voicemail only reliably captures the 3% who were going to book you anyway.</p>
                </div>

                <h2>How Missed Call Text-Back Changes the Equation</h2>
                <p>When a caller receives an instant text within 2 seconds of not getting through, the dynamic completely changes. They're still on the phone. They're still engaged. The text says: "Hi, press 1 to get a booking link or press 2 for a quote form." They click it. Problem solved.</p>

                <div className="overflow-x-auto my-8">
                    <table className="w-full border-2 border-black">
                        <thead className="bg-black text-white">
                            <tr>
                                <th className="p-4 text-left font-display">Metric</th>
                                <th className="p-4 text-left font-display">Voicemail</th>
                                <th className="p-4 text-left font-display">Missed Call Text-Back</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white">
                            <tr className="border-b-2 border-black">
                                <td className="p-4 font-bold">% callers who engage</td>
                                <td className="p-4 text-red-600">12%</td>
                                <td className="p-4 text-green-600 font-bold">55–70%</td>
                            </tr>
                            <tr className="border-b-2 border-black">
                                <td className="p-4 font-bold">Response time (from caller's perspective)</td>
                                <td className="p-4">Callback hours later</td>
                                <td className="p-4 text-green-600 font-bold">Instant (2 seconds)</td>
                            </tr>
                            <tr className="border-b-2 border-black">
                                <td className="p-4 font-bold">Caller goes to competitor</td>
                                <td className="p-4 text-red-600">~85% of non-leavers</td>
                                <td className="p-4 text-green-600 font-bold">Much lower, they have a next step</td>
                            </tr>
                            <tr className="border-b-2 border-black">
                                <td className="p-4 font-bold">Works after hours?</td>
                                <td className="p-4 text-yellow-600">Takes message only</td>
                                <td className="p-4 text-green-600 font-bold">Yes, sends booking link 24/7</td>
                            </tr>
                            <tr>
                                <td className="p-4 font-bold">Booking conversion</td>
                                <td className="p-4 text-red-600">Requires manual callback</td>
                                <td className="p-4 text-green-600 font-bold">Self-service, they book directly</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <h2>The Timing Effect: Why 2 Seconds Matters</h2>
                <p>Research consistently shows that speed to response is the single biggest factor in lead conversion. Businesses that respond within 5 minutes are 21× more likely to convert a lead than those that respond in 30 minutes.</p>
                <p className="mt-4">Voicemail requires you to: check for messages, listen to them, look up the caller, call them back, hope they pick up, and go through a booking conversation. That chain of events takes hours or days. By then, they're booked with someone else.</p>
                <p className="mt-4">An instant text-back with a booking link collapses that entire chain into a 30-second self-service action for the caller. No callbacks needed. No game of phone tag.</p>

                <h2>When Voicemail Still Has a Role</h2>
                <p>Voicemail isn't worthless, it just isn't a <em>lead capture tool</em>. It's a useful fallback for:</p>
                <ul className="space-y-2 my-6 text-gray-700">
                    <li>• Existing clients who know you and are patient enough to wait for a callback</li>
                    <li>• Complex enquiries that require a conversation before booking can happen</li>
                    <li>• Option 3 in your Flynn IVR, "press 3 to leave a voicemail", as a safety net for callers who want to speak with you personally</li>
                </ul>
                <p>The ideal setup: Flynn sends the booking/quote link first (captures the 88% who won't leave a message), with voicemail as an optional third choice for callers who prefer it.</p>

                <SmartStoreCTA
                    headline="Stop Relying on Voicemail, Send a Booking Link Instead"
                    body="Flynn captures the 88% of callers who never leave voicemails by sending them an instant booking or quote link by SMS."
                />
            </>
        )
    },

    // ─── Cluster B continued ──────────────────────────────────────────────────

    "ai-receptionist-for-electricians-australia": {
        title: "AI Receptionist for Electricians: Stop Missing Emergency Calls (Australia)",
        date: "Mar 3, 2026",
        datePublished: "2026-03-03",
        readTime: "7 min read",
        category: "Guide",
        description: "How Australian electricians can stop losing emergency and quote calls to competitors using an AI receptionist that sends instant booking and quote SMS links.",
        content: (
            <>
                <p className="text-xl text-gray-700 leading-relaxed mb-6">
                    When you're in a switchboard, on a roof, or dealing with live cables, your phone is the last thing you can safely touch. But the call you just missed might be a $2,500 panel upgrade or an emergency that pays triple rates. Here's how Australian electricians are solving this without a receptionist.
                </p>

                <h2>The Safety-First Problem</h2>
                <p>Electrical work has an unavoidable conflict: the moments you're doing your highest-value work are exactly the moments you absolutely cannot answer the phone. You can't take a call while working on a live switchboard. You can't step off a roof safely to answer a ringing phone. Safety comes first, which means the call goes unanswered.</p>
                <p className="mt-4">The problem is that emergency electrical callers don't wait. A sparking outlet, a tripped safety switch, a total power loss, these customers are calling 3–5 electricians right now. The first one who picks up or responds wins the job.</p>

                <h2>The 3 Types of Calls Electricians Miss</h2>

                <div className="space-y-6 my-8">
                    <div className="border-l-4 border-red-600 pl-6 py-4 bg-red-50">
                        <h3 className="text-xl font-bold mb-2">1. Electrical Emergencies (40% of missed calls)</h3>
                        <p className="mb-2">Sparking outlets, safety switches tripping, total power loss, burning smell from a switchboard. These customers are scared and calling multiple electricians.</p>
                        <p className="font-bold text-red-800">Average value (AU): $400–$2,400 | If you miss it: it's gone</p>
                    </div>
                    <div className="border-l-4 border-yellow-600 pl-6 py-4 bg-yellow-50">
                        <h3 className="text-xl font-bold mb-2">2. Quote Requests (35% of missed calls)</h3>
                        <p className="mb-2">Panel upgrades, EV charger installations, rewiring, solar switchboard work. The caller is getting 2–3 quotes and first to respond tends to win.</p>
                        <p className="font-bold text-yellow-800">Average value (AU): $1,200–$8,000 | First responder advantage</p>
                    </div>
                    <div className="border-l-4 border-blue-600 pl-6 py-4 bg-blue-50">
                        <h3 className="text-xl font-bold mb-2">3. Routine Work (25% of missed calls)</h3>
                        <p className="mb-2">Outlet additions, light fixtures, ceiling fans, smoke detectors. Quick jobs that fill your calendar between the bigger ones.</p>
                        <p className="font-bold text-blue-800">Average value (AU): $200–$600 | Price-sensitive, speed matters</p>
                    </div>
                </div>

                <h2>How Flynn Works for Electricians</h2>
                <p>Flynn answers your forwarded missed calls, plays a professional greeting, and sends the caller an SMS within 2 seconds of their keypress. For electricians, the IVR flow might look like this:</p>

                <div className="bg-black text-white p-8 my-8">
                    <h3 className="text-xl font-bold mb-6 font-display">Sample IVR for an Electrician</h3>
                    <div className="space-y-4 text-sm font-mono">
                        <div className="border-b border-gray-700 pb-3">
                            <div className="text-gray-400 uppercase text-xs tracking-wider mb-1">Caller hears:</div>
                            <div>"Thanks for calling [Business]. We're on a job right now. For a booking link, press 1. For a quote on a larger job, press 2. For an electrical emergency, press 3."</div>
                        </div>
                        <div className="border-b border-gray-700 pb-3">
                            <div className="text-gray-400 uppercase text-xs tracking-wider mb-1">Press 1 → SMS sent:</div>
                            <div>"Hi, here's our booking link: [link]. Pick a time that works, [Business]"</div>
                        </div>
                        <div className="border-b border-gray-700 pb-3">
                            <div className="text-gray-400 uppercase text-xs tracking-wider mb-1">Press 2 → SMS sent:</div>
                            <div>"Hi, fill in your job details and photos here: [quote link], we'll get back to you ASAP."</div>
                        </div>
                        <div>
                            <div className="text-gray-400 uppercase text-xs tracking-wider mb-1">Press 3 → SMS sent:</div>
                            <div>"Hi, for electrical emergencies we aim to call back within 15 mins. If urgent, here's our direct number: [number]"</div>
                        </div>
                    </div>
                </div>

                <h2>Australian Electricians: What Competitors Charge</h2>

                <div className="overflow-x-auto my-8">
                    <table className="w-full border-2 border-black">
                        <thead className="bg-black text-white">
                            <tr>
                                <th className="p-4 text-left font-display">Option</th>
                                <th className="p-4 text-left font-display">Monthly Cost</th>
                                <th className="p-4 text-left font-display">24/7?</th>
                                <th className="p-4 text-left font-display">Emergency Routing?</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white">
                            <tr className="border-b-2 border-black">
                                <td className="p-4 font-bold">OfficeHQ AU</td>
                                <td className="p-4">$60–$400/mo</td>
                                <td className="p-4 text-red-600 font-bold">No</td>
                                <td className="p-4 text-red-600 font-bold">No</td>
                            </tr>
                            <tr className="border-b-2 border-black">
                                <td className="p-4 font-bold">Virtual receptionist (AU)</td>
                                <td className="p-4">$800–$2,000/mo</td>
                                <td className="p-4 text-yellow-600 font-bold">Extra cost</td>
                                <td className="p-4 text-yellow-600 font-bold">Limited</td>
                            </tr>
                            <tr className="border-b-2 border-black">
                                <td className="p-4 font-bold">Get Fully Booked AU</td>
                                <td className="p-4">$500–$1,200/mo</td>
                                <td className="p-4 text-green-600 font-bold">Yes</td>
                                <td className="p-4 text-green-600 font-bold">Yes</td>
                            </tr>
                            <tr>
                                <td className="p-4 font-bold text-brand-500">Flynn AI</td>
                                <td className="p-4 text-brand-500 font-bold">See app</td>
                                <td className="p-4 text-green-600 font-bold">Yes</td>
                                <td className="p-4 text-green-600 font-bold">Custom IVR</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <h2>Setting Up on Telstra or Optus</h2>
                <p>Flynn works with all Australian carriers. You keep your existing number, just enter a forwarding code and Flynn handles any call you don't answer.</p>
                <p className="mt-4">Full carrier guides: <Link to="/blog/call-forwarding-telstra-missed-call-sms" className="text-brand-500 font-bold hover:underline">Telstra setup →</Link> · <Link to="/blog/call-forwarding-optus-missed-call-sms" className="text-brand-500 font-bold hover:underline">Optus setup →</Link></p>

                <SmartStoreCTA
                    headline="Never Miss Another Electrical Emergency Call"
                    body="Flynn answers every missed call and sends callers a booking or quote link instantly, even at 10 PM when you're off the tools."
                />
            </>
        )
    },

    "ai-receptionist-for-cleaners": {
        title: "AI Receptionist for Cleaners: Fill Your Schedule Without the Back-and-Forth",
        date: "Mar 10, 2026",
        datePublished: "2026-03-10",
        readTime: "5 min read",
        category: "Guide",
        description: "How cleaning businesses use Flynn to capture missed calls and send instant booking links, so you fill your schedule without stopping mid-job to answer the phone.",
        content: (
            <>
                <p className="text-xl text-gray-700 leading-relaxed mb-6">
                    You're in the middle of a bathroom deep-clean. Hands full. Ears plugged with earbuds. Your phone rings, you can't answer. That was someone looking for a regular weekly cleaner worth $200/week recurring. And they've already moved on to the next cleaner on their list.
                </p>

                <h2>The Mid-Job Phone Problem for Cleaners</h2>
                <p>Cleaning is hands-on work. You're at a client's property, picking up is unprofessional, and stepping outside to call back means leaving a job half-done. But missing that call often means losing it permanently. Cleaning clients, especially those looking for a regular, tend to book whoever calls back fastest.</p>

                <div className="grid md:grid-cols-2 gap-6 my-8">
                    <div className="bg-white border-2 border-black p-6">
                        <Wrench className="text-brand-500 mb-4" size={32} />
                        <h3 className="text-xl font-bold mb-3">The Recurring Value Problem</h3>
                        <p className="text-gray-700">A regular weekly clean at $200/week is worth $10,400/year. Missing that initial call doesn't cost you one job, it costs you an entire client relationship.</p>
                    </div>
                    <div className="bg-white border-2 border-black p-6">
                        <Phone className="text-brand-500 mb-4" size={32} />
                        <h3 className="text-xl font-bold mb-3">The Rescheduling Headache</h3>
                        <p className="text-gray-700">Existing clients also call to reschedule. Without a booking link, every change becomes a phone tag chain, multiple calls, texts, and calendar conflicts.</p>
                    </div>
                </div>

                <h2>How Flynn Solves Both Problems</h2>
                <p>Flynn handles missed calls with an instant IVR and SMS link system. For a cleaning business, your menu might offer:</p>

                <ul className="space-y-3 my-6">
                    <li className="flex items-start gap-3">
                        <CheckCircle className="text-green-600 mt-1 flex-shrink-0" size={20} />
                        <span><strong>Press 1, Book a clean:</strong> New clients get your booking page where they pick a date, time, and clean type</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <CheckCircle className="text-green-600 mt-1 flex-shrink-0" size={20} />
                        <span><strong>Press 2, Get a quote:</strong> They fill in property size, frequency, and any special requirements, you quote them without a phone conversation</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <CheckCircle className="text-green-600 mt-1 flex-shrink-0" size={20} />
                        <span><strong>Press 3, Leave a voicemail:</strong> For clients who prefer to speak with you directly</span>
                    </li>
                </ul>

                <p>The SMS goes out within 2 seconds. The caller is still on the phone when they receive it. They click the link, book the slot, and you get a notification, all without interrupting the job you're on.</p>

                <h2>The Math for Cleaning Businesses</h2>

                <div className="bg-surface-50 border-2 border-black p-8 my-8">
                    <h3 className="text-2xl font-bold mb-6">Recovering Just 2 New Regulars Per Month</h3>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center pb-3 border-b-2 border-gray-200">
                            <span className="font-bold">New regular clients recovered/month:</span>
                            <span className="text-2xl">2</span>
                        </div>
                        <div className="flex justify-between items-center pb-3 border-b-2 border-gray-200">
                            <span className="font-bold">Weekly rate per client:</span>
                            <span className="text-2xl">$200</span>
                        </div>
                        <div className="flex justify-between items-center pb-3 border-b-2 border-gray-200">
                            <span className="font-bold">Annual value per client:</span>
                            <span className="text-2xl">$10,400</span>
                        </div>
                        <div className="flex justify-between items-center pt-4">
                            <span className="font-bold text-xl">Annual revenue recovered:</span>
                            <span className="text-4xl font-bold text-brand-500">$20,800</span>
                        </div>
                    </div>
                </div>

                <SmartStoreCTA
                    headline="Fill Your Cleaning Schedule Without Missing a Call"
                    body="Flynn sends new clients a booking link and existing clients a reschedule link, all automatically when you can't pick up."
                />
            </>
        )
    },

    "ai-receptionist-for-painters": {
        title: "AI Receptionist for Painters: Book More Quotes While You're on the Brush",
        date: "Mar 17, 2026",
        datePublished: "2026-03-17",
        readTime: "5 min read",
        category: "Guide",
        description: "How painting businesses use Flynn AI to capture missed calls and send instant quote form links, so you never lose a $5,000 job because you were mid-coat.",
        content: (
            <>
                <p className="text-xl text-gray-700 leading-relaxed mb-6">
                    Painting is a trade where both hands are always busy and the job requires total concentration. A full interior repaint is worth $4,000–$12,000, and that call you missed while on a ladder might have been exactly that. Here's how painters are capturing those leads automatically.
                </p>

                <h2>Why Painters Miss More Quotes Than Any Other Trade</h2>
                <p>Painting is uniquely quote-heavy. Customers rarely call a painter for an emergency, they're planning a project, getting multiple quotes, and going with whoever responds most professionally and quickly. This makes speed of response even more critical than for reactive trades like plumbers.</p>
                <p className="mt-4">When a homeowner calls for a quote on repainting their home and gets voicemail, they call the next painter on the list. By the time you call back, they've already booked a competitor or mentally decided to go with someone who gave them a quote link on the spot.</p>

                <div className="bg-surface-50 border-2 border-black p-6 my-8 border-l-4 border-brand-500">
                    <h3 className="text-xl font-bold mb-3">The Quote Job Numbers for Painters (AU)</h3>
                    <div className="grid md:grid-cols-3 gap-6 mt-4">
                        <div className="text-center">
                            <div className="text-3xl font-bold text-brand-500 mb-1">$4K–$12K</div>
                            <div className="text-sm text-gray-600">Full interior repaint</div>
                        </div>
                        <div className="text-center">
                            <div className="text-3xl font-bold text-brand-500 mb-1">$1.5K–$4K</div>
                            <div className="text-sm text-gray-600">Single room or exterior trim</div>
                        </div>
                        <div className="text-center">
                            <div className="text-3xl font-bold text-brand-500 mb-1">3–5</div>
                            <div className="text-sm text-gray-600">Quotes a homeowner typically gets</div>
                        </div>
                    </div>
                </div>

                <h2>Flynn's Quote Form Link: Ideal for Painters</h2>
                <p>Flynn's "Press 2 for a quote" option is especially powerful for painting businesses. When a caller presses 2, they receive a link to your quote intake form where they can:</p>

                <ul className="space-y-3 my-6">
                    <li className="flex items-start gap-3">
                        <CheckCircle className="text-green-600 mt-1 flex-shrink-0" size={20} />
                        <span>Describe the scope (number of rooms, exterior, feature walls)</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <CheckCircle className="text-green-600 mt-1 flex-shrink-0" size={20} />
                        <span>Upload photos of the space so you can pre-estimate before calling back</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <CheckCircle className="text-green-600 mt-1 flex-shrink-0" size={20} />
                        <span>Provide their address and preferred timeline</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <CheckCircle className="text-green-600 mt-1 flex-shrink-0" size={20} />
                        <span>Leave contact details so you can follow up with a proper quote</span>
                    </li>
                </ul>

                <p>You finish the job you're on, check Flynn, and see 3 structured quote requests waiting, each with photos and job details. You can call them back prepared, or send a rough estimate by SMS. That's a more professional interaction than any competitor who missed the call too and called back cold.</p>

                <h2>What This Looks Like on a Busy Day</h2>

                <div className="bg-black text-white p-8 my-8">
                    <h3 className="text-xl font-bold mb-4">A Painter's Morning Without Flynn</h3>
                    <p className="text-gray-300 mb-6">6 calls come in while you're painting a ceiling. 5 go to voicemail. 1 caller leaves a message. You check messages at lunch, the one voicemail is garbled, the number's hard to read. By 2 PM you've called back 3 numbers, reached 1 person who already booked someone else.</p>
                    <h3 className="text-xl font-bold mb-4 text-brand-500">The Same Morning With Flynn</h3>
                    <p className="text-gray-300">6 calls come in. Flynn answers all 6. 4 press 2 for a quote link and fill in the form. 1 presses 1 and books a site visit. 1 leaves a voicemail. You check Flynn at lunch: 5 structured leads waiting, 1 site visit already booked. You spend 20 minutes sending quotes from the job site.</p>
                </div>

                <SmartStoreCTA
                    headline="Stop Losing Quote Jobs While You're Mid-Coat"
                    body="Flynn sends every missed caller an instant quote form link, so you have structured job details waiting when you finish the job you're on."
                />
            </>
        )
    },

    "ai-receptionist-for-beauty-salons": {
        title: "AI Receptionist for Beauty Salons: Never Lose a Booking Again",
        date: "Mar 24, 2026",
        datePublished: "2026-03-24",
        readTime: "5 min read",
        category: "Guide",
        description: "How beauty salons and hair studios use Flynn AI to capture missed calls and send instant booking links, even when you're mid-appointment and can't pick up.",
        content: (
            <>
                <p className="text-xl text-gray-700 leading-relaxed mb-6">
                    You're mid-blowout. Your client is in the chair. Your phone rings and you can't answer, it would be rude, impractical, and unprofessional. But that caller wanted to book a colour appointment worth $280. They've already hung up and called the next salon.
                </p>

                <h2>The Mid-Appointment Reality</h2>
                <p>For beauty professionals, the conflict is unavoidable: your best work requires your full attention, but clients calling to book are your future revenue. Every hour you're seeing clients is an hour your phone goes unanswered, and beauty clients are especially likely to book with whoever responds first.</p>

                <div className="grid md:grid-cols-2 gap-6 my-8">
                    <div className="bg-white border-2 border-black p-6">
                        <DollarSign className="text-brand-500 mb-4" size={32} />
                        <h3 className="text-xl font-bold mb-3">The Revenue You're Missing</h3>
                        <p className="text-gray-700 text-sm">A full colour and cut is $250–$400. A regular client visits 6–8 times per year. Missing the initial booking call costs you $1,500–$3,200 in annual client value.</p>
                    </div>
                    <div className="bg-white border-2 border-black p-6">
                        <TrendingUp className="text-brand-500 mb-4" size={32} />
                        <h3 className="text-xl font-bold mb-3">The Rebooking Gap</h3>
                        <p className="text-gray-700 text-sm">Clients who don't rebook before they leave often call later to schedule. If you miss that call, you lose the rebooking, and they end up at a competitor.</p>
                    </div>
                </div>

                <h2>Flynn for Beauty: Press 1 to Book Your Appointment</h2>
                <p>Flynn's IVR is fully customisable for a salon or studio. A typical beauty salon setup:</p>

                <div className="bg-surface-50 border-2 border-black p-6 my-8">
                    <div className="space-y-4">
                        <div className="flex gap-4 items-start">
                            <div className="bg-brand-500 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold flex-shrink-0 text-sm">1</div>
                            <div>
                                <div className="font-bold">"Thanks for calling [Salon Name]. We're with a client right now."</div>
                            </div>
                        </div>
                        <div className="flex gap-4 items-start">
                            <div className="bg-black text-white rounded-full w-8 h-8 flex items-center justify-center font-bold flex-shrink-0 text-sm">→</div>
                            <div>
                                <div className="font-bold">Press 1</div>
                                <div className="text-gray-600 text-sm mt-1">SMS: "Hi! Book your next appointment here: [booking link], [Salon Name] 💛"</div>
                            </div>
                        </div>
                        <div className="flex gap-4 items-start">
                            <div className="bg-black text-white rounded-full w-8 h-8 flex items-center justify-center font-bold flex-shrink-0 text-sm">→</div>
                            <div>
                                <div className="font-bold">Press 2</div>
                                <div className="text-gray-600 text-sm mt-1">SMS: "Hi! Tell us what you're after and we'll get back to you: [quote/enquiry link]"</div>
                            </div>
                        </div>
                        <div className="flex gap-4 items-start">
                            <div className="bg-black text-white rounded-full w-8 h-8 flex items-center justify-center font-bold flex-shrink-0 text-sm">→</div>
                            <div>
                                <div className="font-bold">Press 3</div>
                                <div className="text-gray-600 text-sm mt-1">Voicemail, for clients who prefer to leave a message</div>
                            </div>
                        </div>
                    </div>
                </div>

                <h2>After-Hours Bookings: The Biggest Opportunity</h2>
                <p>Most salons are open 9–6. But clients browse Instagram and think about booking in the evenings and on weekends, exactly when you're closed. Flynn runs 24/7, so a client who decides at 9 PM they want a colour appointment gets an instant booking link, and you wake up with a new booking already in your calendar.</p>

                <div className="bg-black text-white p-8 my-8">
                    <h3 className="text-2xl font-bold mb-4">After-Hours Bookings Add Up</h3>
                    <div className="grid md:grid-cols-3 gap-6">
                        <div className="text-center">
                            <div className="text-3xl font-bold text-brand-500 mb-1">35%</div>
                            <div className="text-sm text-gray-300">of inbound booking calls come outside business hours</div>
                        </div>
                        <div className="text-center">
                            <div className="text-3xl font-bold text-brand-500 mb-1">$280</div>
                            <div className="text-sm text-gray-300">average service value per appointment</div>
                        </div>
                        <div className="text-center">
                            <div className="text-3xl font-bold text-brand-500 mb-1">24/7</div>
                            <div className="text-sm text-gray-300">Flynn is always on, even when you're not</div>
                        </div>
                    </div>
                </div>

                <SmartStoreCTA
                    headline="Fill Your Appointment Book Without Stopping Mid-Service"
                    body="Flynn sends every missed caller an instant booking link, even at 9 PM. Wake up with new appointments already confirmed."
                />
            </>
        )
    },

    // ─── Cluster C continued ──────────────────────────────────────────────────

    "call-forwarding-optus-missed-call-sms": {
        title: "How to Set Up Call Forwarding on Optus (Step-by-Step Guide)",
        date: "Apr 4, 2026",
        datePublished: "2026-04-04",
        readTime: "4 min read",
        category: "How-To",
        description: "Exact Optus call forwarding codes for Australian small businesses, forward missed calls to Flynn to automatically send callers a booking or quote SMS link.",
        content: (
            <>
                <p className="text-xl text-gray-700 leading-relaxed mb-6">
                    If you're on Optus, setting up call forwarding to Flynn takes about 30 seconds. You type a code in your phone's dialler, press call, and from that point any call you don't answer goes to Flynn, which sends the caller a booking or quote link by SMS. Here are the exact codes.
                </p>

                <h2>Optus Forwarding Codes (All Types)</h2>

                <div className="space-y-4 my-8">
                    <div className="bg-surface-50 border-2 border-black p-6">
                        <h3 className="text-lg font-bold mb-2">Forward when no answer (recommended)</h3>
                        <p className="text-gray-600 text-sm mb-3">Rings your phone normally, then forwards after 20 seconds if you don't answer</p>
                        <code className="bg-black text-brand-500 px-4 py-3 text-lg block font-mono">*61*[Flynn number]*11*20#</code>
                        <p className="text-xs text-gray-500 mt-2">Change 20 to 15 or 30 to adjust the ring time before forwarding</p>
                    </div>

                    <div className="bg-surface-50 border-2 border-black p-6">
                        <h3 className="text-lg font-bold mb-2">Forward when busy</h3>
                        <p className="text-gray-600 text-sm mb-3">Forwards when you're already on a call</p>
                        <code className="bg-black text-brand-500 px-4 py-3 text-lg block font-mono">*67*[Flynn number]#</code>
                    </div>

                    <div className="bg-surface-50 border-2 border-black p-6">
                        <h3 className="text-lg font-bold mb-2">Forward when unreachable</h3>
                        <p className="text-gray-600 text-sm mb-3">Catches calls when your phone is off or has no signal</p>
                        <code className="bg-black text-brand-500 px-4 py-3 text-lg block font-mono">*62*[Flynn number]#</code>
                    </div>

                    <div className="bg-surface-50 border-2 border-black p-6">
                        <h3 className="text-lg font-bold mb-2">Forward all calls</h3>
                        <p className="text-gray-600 text-sm mb-3">Every call goes to Flynn, use when you're on a job site all day</p>
                        <code className="bg-black text-brand-500 px-4 py-3 text-lg block font-mono">*21*[Flynn number]#</code>
                    </div>

                    <div className="bg-surface-50 border-2 border-black p-6">
                        <h3 className="text-lg font-bold mb-2">Cancel all forwarding</h3>
                        <p className="text-gray-600 text-sm mb-3">Returns your phone to normal call handling</p>
                        <code className="bg-black text-brand-500 px-4 py-3 text-lg block font-mono">##002#</code>
                    </div>
                </div>

                <h2>Optus-Specific Notes</h2>

                <ul className="space-y-3 my-6 text-gray-700">
                    <li className="flex items-start gap-3">
                        <CheckCircle className="text-green-600 mt-1 flex-shrink-0" size={20} />
                        <span><strong>Postpaid plans:</strong> Forwarding is included at no extra cost on all standard Optus postpaid plans</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <CheckCircle className="text-green-600 mt-1 flex-shrink-0" size={20} />
                        <span><strong>Prepaid plans:</strong> Conditional forwarding (no answer/busy) works on most Optus prepaid plans. Unconditional forwarding (*21) may not be available on some prepaid plans, test it first</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <CheckCircle className="text-green-600 mt-1 flex-shrink-0" size={20} />
                        <span><strong>Confirmation:</strong> After entering the code and pressing call, you'll hear a confirmation tone and may see an on-screen message. If you get an error, check you've included the # at the end</span>
                    </li>
                </ul>

                <h2>How to Enter the Code (Step by Step)</h2>
                <ol className="list-decimal list-inside space-y-3 my-6 text-gray-700">
                    <li>Open your Phone app and go to the <strong>keypad / dialler</strong></li>
                    <li>Type the full code with your Flynn number where it says [Flynn number], include the country code format: e.g. <code className="bg-gray-100 px-2 py-0.5 text-sm">*61*0400000000*11*20#</code></li>
                    <li>Press the green <strong>Call</strong> button</li>
                    <li>You'll get a confirmation, forwarding is now active</li>
                    <li>Test it by calling yourself from another phone and letting it ring</li>
                </ol>

                <div className="bg-surface-50 border-2 border-black p-6 my-8 border-l-4 border-brand-500">
                    <h3 className="font-bold mb-2">Best Setup for Most Tradies on Optus</h3>
                    <p className="text-gray-700 text-sm">Run both <strong>*61</strong> (forward when no answer) and <strong>*67</strong> (forward when busy). This means calls you answer go straight to you as normal. Calls you miss because you're on a job or on another call go to Flynn for instant SMS handling.</p>
                </div>

                <p className="text-gray-600">Also on Telstra? See: <Link to="/blog/call-forwarding-telstra-missed-call-sms" className="text-brand-500 font-bold hover:underline">How to set up call forwarding on Telstra →</Link></p>

                <SmartStoreCTA
                    headline="Forward Your Optus Calls to Flynn"
                    body="Once set up, Flynn handles every missed call and sends callers an instant booking or quote link. 30 seconds to configure."
                />
            </>
        )
    },

    "how-to-create-booking-link-trade-business": {
        title: "How to Create a Booking Link for Your Trade Business (Free Guide)",
        date: "Apr 8, 2026",
        datePublished: "2026-04-08",
        readTime: "6 min read",
        category: "How-To",
        description: "Step-by-step guide to creating a booking link for a trade or service business, including free options and how Flynn's native booking page integrates with your missed call flow.",
        content: (
            <>
                <p className="text-xl text-gray-700 leading-relaxed mb-6">
                    A booking link is a URL you send to customers so they can pick an available time slot without the back-and-forth of phone or text scheduling. For tradespeople, it's the key piece that turns a missed call into a confirmed job, automatically. Here's how to create one.
                </p>

                <h2>What a Booking Link Actually Does</h2>
                <p>When a customer clicks your booking link, they see a calendar showing your available slots. They pick a time. You get a notification and the appointment is locked in your calendar. No phone tag. No "does 3pm work?" messages. No double-bookings.</p>
                <p className="mt-4">For missed call recovery specifically, a booking link sent by SMS means the caller doesn't need to wait for a callback, they can self-serve the booking immediately, which is when they're most motivated to book.</p>

                <h2>Your 3 Options Compared</h2>

                <div className="overflow-x-auto my-8">
                    <table className="w-full border-2 border-black">
                        <thead className="bg-black text-white">
                            <tr>
                                <th className="p-4 text-left font-display">Option</th>
                                <th className="p-4 text-left font-display">Cost</th>
                                <th className="p-4 text-left font-display">Trade-Specific?</th>
                                <th className="p-4 text-left font-display">Integrates with SMS?</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white">
                            <tr className="border-b-2 border-black">
                                <td className="p-4 font-bold">Calendly</td>
                                <td className="p-4">Free – $16/mo</td>
                                <td className="p-4 text-yellow-600 font-bold">Generic</td>
                                <td className="p-4 text-red-600 font-bold">Manual only</td>
                            </tr>
                            <tr className="border-b-2 border-black">
                                <td className="p-4 font-bold">Square Appointments</td>
                                <td className="p-4">Free – $29/mo</td>
                                <td className="p-4 text-yellow-600 font-bold">Service-oriented</td>
                                <td className="p-4 text-red-600 font-bold">No</td>
                            </tr>
                            <tr className="border-b-2 border-black">
                                <td className="p-4 font-bold">Google Calendar (shareable)</td>
                                <td className="p-4">Free</td>
                                <td className="p-4 text-red-600 font-bold">No</td>
                                <td className="p-4 text-red-600 font-bold">No</td>
                            </tr>
                            <tr>
                                <td className="p-4 font-bold text-brand-500">Flynn Booking Page</td>
                                <td className="p-4 text-brand-500 font-bold">Included in Flynn</td>
                                <td className="p-4 text-green-600 font-bold">Built for trades</td>
                                <td className="p-4 text-green-600 font-bold">Automatic via IVR</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <h2>Why Flynn's Booking Page Is Built for Trades</h2>
                <p>Generic booking tools like Calendly are built for meetings and consultations. Flynn's booking page is designed around how trade jobs actually work:</p>

                <ul className="space-y-3 my-6">
                    <li className="flex items-start gap-3">
                        <CheckCircle className="text-green-600 mt-1 flex-shrink-0" size={20} />
                        <span><strong>Job type fields:</strong> Caller can specify if it's a repair, install, quote visit, or emergency, so you know what you're walking into before you arrive</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <CheckCircle className="text-green-600 mt-1 flex-shrink-0" size={20} />
                        <span><strong>Photo upload:</strong> Client attaches photos of the problem, you pre-assess before the callout and quote more accurately</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <CheckCircle className="text-green-600 mt-1 flex-shrink-0" size={20} />
                        <span><strong>Address collection:</strong> Booking includes property address so you can plan your route</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <CheckCircle className="text-green-600 mt-1 flex-shrink-0" size={20} />
                        <span><strong>No credit card required:</strong> Clients book without paying upfront, keeps the friction low</span>
                    </li>
                </ul>

                <h2>How to Create Your Flynn Booking Page</h2>
                <ol className="list-decimal list-inside space-y-3 my-6 text-gray-700">
                    <li>Open Flynn and go to <strong>Settings → Booking Page</strong></li>
                    <li>Add your business name, service types, and available hours</li>
                    <li>Flynn generates a unique booking URL (e.g. <code className="bg-gray-100 px-2 py-0.5 text-sm">flynnbooking.app/your-business</code>)</li>
                    <li>This URL is automatically sent in your missed call SMS when a caller presses 1</li>
                    <li>New bookings appear in your Flynn dashboard and optionally sync to your calendar</li>
                </ol>

                <h2>The Full Missed Call → Booked Job Flow</h2>
                <div className="bg-black text-white p-6 my-8">
                    <div className="space-y-3 text-sm">
                        <div className="flex gap-3"><span className="text-brand-500 font-bold">1.</span> Caller dials your number</div>
                        <div className="flex gap-3"><span className="text-brand-500 font-bold">2.</span> You're on a job, Flynn answers</div>
                        <div className="flex gap-3"><span className="text-brand-500 font-bold">3.</span> Caller presses 1 for a booking link</div>
                        <div className="flex gap-3"><span className="text-brand-500 font-bold">4.</span> Flynn texts them your booking page URL instantly</div>
                        <div className="flex gap-3"><span className="text-brand-500 font-bold">5.</span> Caller picks a slot and confirms</div>
                        <div className="flex gap-3"><span className="text-brand-500 font-bold">6.</span> You get a notification, job booked, no phone call required</div>
                    </div>
                </div>

                <SmartStoreCTA
                    headline="Get Your Trade Booking Page Up in 5 Minutes"
                    body="Flynn creates your booking page and automatically sends the link to every missed caller. No tech skills required."
                />
            </>
        )
    },

    "convert-missed-call-booked-job": {
        title: "How to Convert a Missed Call Into a Booked Job (5-Minute Setup)",
        date: "Apr 12, 2026",
        datePublished: "2026-04-12",
        readTime: "6 min read",
        category: "Growth",
        description: "The exact process for converting missed calls into booked jobs automatically, using call forwarding, an IVR menu, and an instant SMS booking link. Takes 5 minutes to set up.",
        content: (
            <>
                <p className="text-xl text-gray-700 leading-relaxed mb-6">
                    Most tradies lose 60–70% of their missed calls permanently. The callers don't leave messages, they don't wait for callbacks, and they don't try again. But with one system set up correctly, you can convert the majority of those calls into booked jobs automatically, without answering the phone.
                </p>

                <h2>Why Callers Don't Come Back</h2>
                <p>When a potential customer calls you and gets voicemail, 88% of them hang up and call the next option. They're not being rude, they just have a problem to solve and they're going to solve it now, with whoever makes it easiest.</p>

                <div className="bg-surface-50 border-2 border-black p-6 my-8 border-l-4 border-red-600">
                    <h3 className="text-xl font-bold mb-3">The 5-Minute Window</h3>
                    <p>Businesses that respond to inbound leads within 5 minutes convert them at 21× the rate of businesses that respond after 30 minutes. A callback hours later, even if the customer is still interested, has already lost most of its conversion power. The only way to be in the 5-minute window when you can't answer is automation.</p>
                </div>

                <h2>The System: 3 Components Working Together</h2>

                <div className="space-y-6 my-8">
                    <div className="bg-white border-2 border-black p-6">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="bg-brand-500 text-white w-10 h-10 flex items-center justify-center font-bold text-xl flex-shrink-0">1</div>
                            <h3 className="text-xl font-bold">Call Forwarding (Your Carrier)</h3>
                        </div>
                        <p className="text-gray-700">You set a forwarding code on your phone (Telstra, Optus, or Vodafone). When you don't answer within 20 seconds, the call automatically routes to Flynn. Your number doesn't change. Callers don't notice anything different.</p>
                        <p className="mt-3 text-sm"><Link to="/blog/call-forwarding-telstra-missed-call-sms" className="text-brand-500 font-bold hover:underline">Telstra forwarding guide →</Link> · <Link to="/blog/call-forwarding-optus-missed-call-sms" className="text-brand-500 font-bold hover:underline">Optus forwarding guide →</Link></p>
                    </div>

                    <div className="bg-white border-2 border-black p-6">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="bg-brand-500 text-white w-10 h-10 flex items-center justify-center font-bold text-xl flex-shrink-0">2</div>
                            <h3 className="text-xl font-bold">IVR Menu (Flynn)</h3>
                        </div>
                        <p className="text-gray-700">Flynn answers with your custom greeting and a short menu. Caller presses 1 for a booking link, presses 2 for a quote form. The menu is recorded in your voice or uses a professional AI voice, your choice.</p>
                    </div>

                    <div className="bg-white border-2 border-black p-6">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="bg-brand-500 text-white w-10 h-10 flex items-center justify-center font-bold text-xl flex-shrink-0">3</div>
                            <h3 className="text-xl font-bold">Instant SMS + Booking Page</h3>
                        </div>
                        <p className="text-gray-700">Within 2 seconds of the keypress, the caller receives an SMS with the link they requested. They click it, fill in their details or pick a time, and the booking lands in your Flynn dashboard. You get a notification.</p>
                    </div>
                </div>

                <h2>What Your Callers Actually Experience</h2>
                <p>From the caller's perspective, the interaction is fast and professional. They called, someone answered (Flynn), they got a useful immediate response, and they've taken action. Compare that to voicemail, where they're asked to do nothing useful and just wait.</p>

                <div className="overflow-x-auto my-8">
                    <table className="w-full border-2 border-black">
                        <thead className="bg-black text-white">
                            <tr>
                                <th className="p-4 text-left font-display">Step</th>
                                <th className="p-4 text-left font-display">With Voicemail</th>
                                <th className="p-4 text-left font-display">With Flynn</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white">
                            <tr className="border-b-2 border-black">
                                <td className="p-4 font-bold">Call answered?</td>
                                <td className="p-4 text-red-600">No, voicemail</td>
                                <td className="p-4 text-green-600 font-bold">Yes, instantly</td>
                            </tr>
                            <tr className="border-b-2 border-black">
                                <td className="p-4 font-bold">Caller's next step</td>
                                <td className="p-4">Leave a message or hang up</td>
                                <td className="p-4 text-green-600 font-bold">Press 1 or 2, get a link</td>
                            </tr>
                            <tr className="border-b-2 border-black">
                                <td className="p-4 font-bold">Time to book</td>
                                <td className="p-4">Hours or days (callback required)</td>
                                <td className="p-4 text-green-600 font-bold">Under 2 minutes (self-serve)</td>
                            </tr>
                            <tr>
                                <td className="p-4 font-bold">Goes to competitor?</td>
                                <td className="p-4 text-red-600">~85% of callers do</td>
                                <td className="p-4 text-green-600 font-bold">Much lower, they have a next step</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <h2>Setting Up in 5 Minutes</h2>
                <ol className="list-decimal list-inside space-y-3 my-6 text-gray-700">
                    <li>Download Flynn (iOS or Android)</li>
                    <li>Create your booking page with your service types and available hours</li>
                    <li>Write your IVR greeting (Flynn provides templates for common trades)</li>
                    <li>Enter your carrier forwarding code on your phone (30 seconds)</li>
                    <li>Call your own number from another device, let it ring and watch the system work</li>
                </ol>

                <SmartStoreCTA
                    headline="Set Up Missed Call → Booked Job in 5 Minutes"
                    body="Flynn connects call forwarding, an IVR menu, and an instant booking link SMS into one system. Works with your existing number on Telstra, Optus, or Vodafone."
                />
            </>
        )
    },

    // ─── Cluster D continued ──────────────────────────────────────────────────

    "flynn-vs-enzak-missed-call-sms": {
        title: "Flynn AI vs Enzak: Which Missed Call SMS App Is Better in 2025?",
        date: "Apr 22, 2026",
        datePublished: "2026-04-22",
        readTime: "6 min read",
        category: "Comparison",
        description: "Head-to-head comparison of Flynn AI and Enzak for missed call text-back. Covers features, pricing, AU availability, iOS apps, and who each product is best for.",
        content: (
            <>
                <p className="text-xl text-gray-700 leading-relaxed mb-6">
                    Enzak is the closest global competitor to Flynn in the missed call SMS space, but the two products serve quite different markets. Here's an honest breakdown of what each does, where each wins, and which one is right for your business.
                </p>

                <h2>What Each Product Does</h2>

                <div className="grid md:grid-cols-2 gap-6 my-8">
                    <div className="bg-white border-2 border-black p-6">
                        <h3 className="text-2xl font-bold font-display mb-4">Enzak</h3>
                        <p className="text-gray-700 text-sm mb-4">Enzak automatically sends a pre-written SMS when a call is missed. You configure your message in a web dashboard, and it fires every time a call goes unanswered. Simple, reliable, US-focused.</p>
                        <ul className="space-y-2 text-sm text-gray-700">
                            <li>• Auto-SMS on missed call (1-way by default)</li>
                            <li>• IVR/phone tree integration</li>
                            <li>• Business hours vs after-hours templates</li>
                            <li>• 2-way SMS as paid add-on</li>
                            <li>• US and Canada only</li>
                            <li>• No iOS app</li>
                        </ul>
                        <div className="mt-4 pt-4 border-t border-gray-200">
                            <span className="font-bold">Pricing:</span> $20–$99/month USD
                        </div>
                    </div>
                    <div className="bg-white border-2 border-black p-6">
                        <h3 className="text-2xl font-bold font-display mb-4 text-brand-500">Flynn AI</h3>
                        <p className="text-gray-700 text-sm mb-4">Flynn uses an IVR to let callers choose between a booking link or quote form, then sends that specific link by SMS, not a generic reply. Built as a mobile app for service businesses and tradies.</p>
                        <ul className="space-y-2 text-sm text-gray-700">
                            <li>• IVR with Press 1 (booking) / Press 2 (quote)</li>
                            <li>• Instant booking page + quote form link in SMS</li>
                            <li>• iOS and Android native app</li>
                            <li>• Works in Australia (Telstra, Optus, Vodafone)</li>
                            <li>• 24/7 coverage</li>
                            <li>• Call analytics and booking tracking</li>
                        </ul>
                        <div className="mt-4 pt-4 border-t border-gray-200">
                            <span className="font-bold">Pricing:</span> See app
                        </div>
                    </div>
                </div>

                <h2>Feature-by-Feature Comparison</h2>

                <div className="overflow-x-auto my-8">
                    <table className="w-full border-2 border-black">
                        <thead className="bg-black text-white">
                            <tr>
                                <th className="p-4 text-left font-display">Feature</th>
                                <th className="p-4 text-left font-display">Enzak</th>
                                <th className="p-4 text-left font-display">Flynn AI</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white">
                            {[
                                ["Auto-SMS on missed call", "✓", "✓"],
                                ["Booking link in SMS", "✗ (generic text only)", "✓"],
                                ["Quote form link in SMS", "✗", "✓"],
                                ["IVR menu (caller chooses)", "Basic", "✓ Customisable"],
                                ["iOS native app", "✗", "✓"],
                                ["Android native app", "✗", "✓"],
                                ["Australian carrier support", "✗ (US/CA only)", "✓"],
                                ["Call analytics", "Basic", "✓ With booking tracking"],
                                ["24/7 coverage", "✓", "✓"],
                                ["Setup time", "~1 hour (web dashboard)", "~5 min (mobile app)"],
                            ].map(([feature, enzak, flynn], i) => (
                                <tr key={i} className="border-b-2 border-black last:border-0">
                                    <td className="p-4 font-bold">{feature}</td>
                                    <td className={`p-4 ${enzak.startsWith("✗") ? "text-red-600" : "text-green-600"}`}>{enzak}</td>
                                    <td className={`p-4 font-bold ${flynn.startsWith("✗") ? "text-red-600" : "text-green-600"}`}>{flynn}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <h2>Where Enzak Wins</h2>
                <ul className="space-y-3 my-6">
                    <li className="flex items-start gap-3">
                        <CheckCircle className="text-green-600 mt-1 flex-shrink-0" size={20} />
                        <span><strong>US/Canadian businesses wanting a simple, low-cost SMS reply</strong>: Enzak is cheaper and works fine for basic auto-text</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <CheckCircle className="text-green-600 mt-1 flex-shrink-0" size={20} />
                        <span><strong>Businesses already on a compatible US phone system</strong>: Enzak integrates with common US VOIP setups</span>
                    </li>
                </ul>

                <h2>Where Flynn Wins</h2>
                <ul className="space-y-3 my-6">
                    <li className="flex items-start gap-3">
                        <CheckCircle className="text-green-600 mt-1 flex-shrink-0" size={20} />
                        <span><strong>Australian businesses</strong>: Enzak simply doesn't work in Australia. Flynn does, with Telstra, Optus, and Vodafone</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <CheckCircle className="text-green-600 mt-1 flex-shrink-0" size={20} />
                        <span><strong>Businesses that want a booking link, not just a text</strong>: Flynn converts callers into bookings; Enzak just acknowledges the missed call</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <CheckCircle className="text-green-600 mt-1 flex-shrink-0" size={20} />
                        <span><strong>Mobile-first operators</strong>: Flynn is an iOS/Android app managed entirely from your phone; Enzak requires a web dashboard</span>
                    </li>
                </ul>

                <h2>The Bottom Line</h2>
                <p>If you're in the US or Canada and just need a simple auto-text reply, Enzak is a reasonable choice. If you're in Australia, or if you want the missed call to result in an actual booking (not just a text), Flynn is the better product. For Australian tradies specifically, Enzak is simply not an option, it doesn't support AU phone numbers.</p>

                <SmartStoreCTA
                    headline="Flynn: The Missed Call App That Sends Booking Links"
                    body="Not just a text-back, Flynn sends a booking or quote link via IVR SMS. Works in Australia on Telstra, Optus, and Vodafone."
                />
            </>
        )
    },

    "gohighlevel-missed-call-vs-flynn": {
        title: "GoHighLevel Missed Call Text Back vs Flynn AI: An SMB Owner's Guide",
        date: "Apr 28, 2026",
        datePublished: "2026-04-28",
        readTime: "6 min read",
        category: "Comparison",
        description: "Honest comparison of GoHighLevel's missed call text-back feature vs Flynn AI for small business owners and tradies. Who each is actually built for.",
        content: (
            <>
                <p className="text-xl text-gray-700 leading-relaxed mb-6">
                    GoHighLevel has a missed call text-back feature, and it works. But GHL isn't a product built for you, it's a platform built for marketing agencies to resell to clients like you. Here's what that distinction means in practice, and when to use each.
                </p>

                <h2>What GoHighLevel's Missed Call Text-Back Actually Is</h2>
                <p>GHL's missed call text-back is one feature inside a massive CRM platform. When you miss a call, it can automatically send a text. That's the entire feature, a static text, configured in a web dashboard, inside a system that also includes funnels, email campaigns, landing page builders, reputation management, and a dozen other tools.</p>

                <div className="bg-yellow-50 border-2 border-yellow-600 p-6 my-8">
                    <div className="flex gap-3 items-start">
                        <AlertTriangle className="text-yellow-600 flex-shrink-0 mt-1" size={24} />
                        <div>
                            <h3 className="font-bold text-lg mb-2">The Hidden Complexity</h3>
                            <p className="text-gray-700 text-sm">To use GHL's missed call text-back, you need to: sign up for GHL ($97–$297/month), set up a sub-account, configure a Twilio integration (or pay GHL's higher per-message rates), set up a workflow automation, create the text message template, and connect your phone number. That's 6+ steps before a single caller gets a text.</p>
                        </div>
                    </div>
                </div>

                <h2>The Cost Reality</h2>

                <div className="overflow-x-auto my-8">
                    <table className="w-full border-2 border-black">
                        <thead className="bg-black text-white">
                            <tr>
                                <th className="p-4 text-left font-display">Item</th>
                                <th className="p-4 text-left font-display">GoHighLevel</th>
                                <th className="p-4 text-left font-display">Flynn AI</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white">
                            <tr className="border-b-2 border-black">
                                <td className="p-4 font-bold">Platform subscription</td>
                                <td className="p-4">$97–$297/mo minimum</td>
                                <td className="p-4 text-green-600 font-bold">See app</td>
                            </tr>
                            <tr className="border-b-2 border-black">
                                <td className="p-4 font-bold">Setup time</td>
                                <td className="p-4">Days (multiple integrations)</td>
                                <td className="p-4 text-green-600 font-bold">5 minutes</td>
                            </tr>
                            <tr className="border-b-2 border-black">
                                <td className="p-4 font-bold">SMS sends booking link?</td>
                                <td className="p-4 text-yellow-600">Only if you build the workflow</td>
                                <td className="p-4 text-green-600 font-bold">Yes, natively</td>
                            </tr>
                            <tr className="border-b-2 border-black">
                                <td className="p-4 font-bold">Mobile app for management</td>
                                <td className="p-4 text-yellow-600">Yes, but complex</td>
                                <td className="p-4 text-green-600 font-bold">Simple iOS/Android app</td>
                            </tr>
                            <tr className="border-b-2 border-black">
                                <td className="p-4 font-bold">Australian carrier support</td>
                                <td className="p-4 text-yellow-600">Possible but requires Twilio AU setup</td>
                                <td className="p-4 text-green-600 font-bold">Built-in</td>
                            </tr>
                            <tr>
                                <td className="p-4 font-bold">IVR (press 1 / press 2)</td>
                                <td className="p-4 text-yellow-600">Possible with advanced setup</td>
                                <td className="p-4 text-green-600 font-bold">Built-in, out of the box</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <h2>Who GoHighLevel Is Actually Built For</h2>
                <p>GHL is a white-label platform. Its primary customers are <strong>marketing agencies</strong> who pay $297/month for the Agency plan, then resell sub-accounts to their clients for $100–$500/month each. The "missed call text-back" is one of the features agencies pitch to those clients.</p>
                <p className="mt-4">If you're a tradie or small service business owner, you're not GHL's customer, you're the end client that a GHL agency would sell to. You'd be paying agency markup on top of GHL's cost, or paying for GHL yourself and navigating a platform built for marketers.</p>

                <h2>When GHL Makes Sense</h2>
                <ul className="space-y-3 my-6">
                    <li className="flex items-start gap-3">
                        <CheckCircle className="text-green-600 mt-1 flex-shrink-0" size={20} />
                        <span>You need a full CRM, email automation, funnel builder, AND missed call text-back in one platform</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <CheckCircle className="text-green-600 mt-1 flex-shrink-0" size={20} />
                        <span>You're running a multi-location business with dedicated marketing staff who can manage the platform</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <CheckCircle className="text-green-600 mt-1 flex-shrink-0" size={20} />
                        <span>A marketing agency is managing GHL for you and including missed call text-back as part of their retainer</span>
                    </li>
                </ul>

                <h2>When Flynn Makes Sense</h2>
                <ul className="space-y-3 my-6">
                    <li className="flex items-start gap-3">
                        <CheckCircle className="text-green-600 mt-1 flex-shrink-0" size={20} />
                        <span>You're a sole trader or run a small crew and just need missed calls handled professionally</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <CheckCircle className="text-green-600 mt-1 flex-shrink-0" size={20} />
                        <span>You want to be up and running in 5 minutes, not 5 days</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <CheckCircle className="text-green-600 mt-1 flex-shrink-0" size={20} />
                        <span>You're in Australia and need Telstra/Optus support that actually works out of the box</span>
                    </li>
                </ul>

                <SmartStoreCTA
                    headline="All the Missed Call Handling, None of the CRM Overhead"
                    body="Flynn does one thing extremely well: turns missed calls into bookings. No agency required, no $297/month platform, just a 5-minute setup on your existing number."
                />
            </>
        )
    },

    "best-missed-call-app-small-business-australia": {
        title: "Best Missed Call Apps for Small Business in Australia (2026 Roundup)",
        date: "May 5, 2026",
        datePublished: "2026-05-05",
        readTime: "8 min read",
        category: "Comparison",
        description: "The definitive 2026 roundup of missed call text-back apps for Australian small businesses, comparing Flynn AI, Enzak, Grasshopper, OfficeHQ, and GoHighLevel.",
        content: (
            <>
                <p className="text-xl text-gray-700 leading-relaxed mb-6">
                    If you're an Australian small business owner searching for a way to automatically handle missed calls, your options are limited, most of the products that appear in search are built for the US market and simply don't work with Australian phone numbers. Here's an honest roundup of every real option, and which one is right for you.
                </p>

                <h2>What to Look for in a Missed Call App</h2>
                <p>Before comparing products, here are the criteria that actually matter for an Australian small business or tradie:</p>

                <ul className="space-y-3 my-6">
                    <li className="flex items-start gap-3">
                        <CheckCircle className="text-green-600 mt-1 flex-shrink-0" size={20} />
                        <span><strong>Australian carrier support</strong>: Does it work with Telstra, Optus, and Vodafone? If not, you can't use it.</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <CheckCircle className="text-green-600 mt-1 flex-shrink-0" size={20} />
                        <span><strong>Works with your existing number</strong>: You don't want to hand out a new number and confuse existing customers</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <CheckCircle className="text-green-600 mt-1 flex-shrink-0" size={20} />
                        <span><strong>Sends a booking link, not just a text</strong>: A static "I'll call you back" SMS doesn't convert. A booking link does.</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <CheckCircle className="text-green-600 mt-1 flex-shrink-0" size={20} />
                        <span><strong>Mobile app for management</strong>: You're running a trade business from your phone, not a desktop</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <CheckCircle className="text-green-600 mt-1 flex-shrink-0" size={20} />
                        <span><strong>Affordable and self-serve</strong>: You shouldn't need an agency or a $300/month CRM platform to handle missed calls</span>
                    </li>
                </ul>

                <h2>The Shortlist: 5 Options Reviewed</h2>

                <div className="space-y-8 my-8">
                    <div className="bg-white border-2 border-black p-6">
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="text-2xl font-bold font-display text-brand-500">1. Flynn AI</h3>
                            <span className="bg-black text-white px-3 py-1 text-sm font-bold uppercase">Best for AU Tradies</span>
                        </div>
                        <p className="text-gray-700 mb-4 text-sm">The only missed call app purpose-built for Australian service businesses. Uses IVR (Press 1 / Press 2) to send callers a booking link or quote form link instantly. Works with Telstra, Optus, and Vodafone. iOS and Android native app.</p>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <div className="font-bold text-green-600 mb-1">Pros</div>
                                <ul className="space-y-1 text-gray-700">
                                    <li>✓ Sends booking + quote link</li>
                                    <li>✓ Works in Australia</li>
                                    <li>✓ iOS + Android app</li>
                                    <li>✓ 5-minute setup</li>
                                    <li>✓ 24/7 coverage</li>
                                </ul>
                            </div>
                            <div>
                                <div className="font-bold text-red-600 mb-1">Cons</div>
                                <ul className="space-y-1 text-gray-700">
                                    <li>✗ No live human answering</li>
                                    <li>✗ Newer product, smaller user base</li>
                                </ul>
                            </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-gray-200 text-sm font-bold">Pricing: See app</div>
                    </div>

                    <div className="bg-white border-2 border-black p-6">
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="text-2xl font-bold font-display">2. Enzak</h3>
                            <span className="bg-gray-200 text-gray-800 px-3 py-1 text-sm font-bold uppercase">Best for US/CA Only</span>
                        </div>
                        <p className="text-gray-700 mb-4 text-sm">Sends an auto-text when a call is missed. Solid product for US/Canadian businesses. <strong>Does not work in Australia</strong>: US and Canadian phone numbers only.</p>
                        <div className="text-sm font-bold text-red-600">⚠ Not available in Australia</div>
                        <div className="mt-4 pt-4 border-t border-gray-200 text-sm font-bold">Pricing: $20–$99 USD/month</div>
                    </div>

                    <div className="bg-white border-2 border-black p-6">
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="text-2xl font-bold font-display">3. Grasshopper (Instant Response)</h3>
                            <span className="bg-gray-200 text-gray-800 px-3 py-1 text-sm font-bold uppercase">US Virtual Phone System</span>
                        </div>
                        <p className="text-gray-700 mb-4 text-sm">US virtual phone system with a missed call text-back feature built in. To use it, you need to take a Grasshopper phone number (can't use your existing AU mobile). Not designed for Australian carriers.</p>
                        <div className="text-sm font-bold text-red-600">⚠ Requires a US virtual number, not practical for AU businesses</div>
                        <div className="mt-4 pt-4 border-t border-gray-200 text-sm font-bold">Pricing: $14–$55 USD/month (US only)</div>
                    </div>

                    <div className="bg-white border-2 border-black p-6">
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="text-2xl font-bold font-display">4. OfficeHQ (AU)</h3>
                            <span className="bg-gray-200 text-gray-800 px-3 py-1 text-sm font-bold uppercase">Best AU Human Answering</span>
                        </div>
                        <p className="text-gray-700 mb-4 text-sm">Australian human virtual reception service. Real people answer calls during business hours and take a message. No AI, no 24/7 coverage, no booking link, but genuine human interaction during business hours.</p>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <div className="font-bold text-green-600 mb-1">Pros</div>
                                <ul className="space-y-1 text-gray-700">
                                    <li>✓ Australian-based humans</li>
                                    <li>✓ Works with your AU number</li>
                                    <li>✓ Understands local context</li>
                                </ul>
                            </div>
                            <div>
                                <div className="font-bold text-red-600 mb-1">Cons</div>
                                <ul className="space-y-1 text-gray-700">
                                    <li>✗ Business hours only</li>
                                    <li>✗ No booking link</li>
                                    <li>✗ $60–$400/month</li>
                                </ul>
                            </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-gray-200 text-sm font-bold">Pricing: $60–$400 AUD/month</div>
                    </div>

                    <div className="bg-white border-2 border-black p-6">
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="text-2xl font-bold font-display">5. GoHighLevel</h3>
                            <span className="bg-gray-200 text-gray-800 px-3 py-1 text-sm font-bold uppercase">Best for Marketing Agencies</span>
                        </div>
                        <p className="text-gray-700 mb-4 text-sm">Full CRM platform with missed call text-back as one of many features. Powerful but expensive and complex. Built for marketing agencies, not individual tradies. AU setup requires additional Twilio configuration.</p>
                        <div className="mt-4 pt-4 border-t border-gray-200 text-sm font-bold">Pricing: $97–$297 USD/month</div>
                    </div>
                </div>

                <h2>Head-to-Head Comparison Table</h2>

                <div className="overflow-x-auto my-8">
                    <table className="w-full border-2 border-black text-sm">
                        <thead className="bg-black text-white">
                            <tr>
                                <th className="p-3 text-left font-display">Feature</th>
                                <th className="p-3 text-left font-display">Flynn</th>
                                <th className="p-3 text-left font-display">Enzak</th>
                                <th className="p-3 text-left font-display">Grasshopper</th>
                                <th className="p-3 text-left font-display">OfficeHQ</th>
                                <th className="p-3 text-left font-display">GHL</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white">
                            {[
                                ["Works in Australia", "✓", "✗", "✗", "✓", "Complex"],
                                ["Your existing number", "✓", "✓", "✗", "✓", "✓"],
                                ["Sends booking link", "✓", "✗", "✗", "✗", "With setup"],
                                ["24/7 coverage", "✓", "✓", "✓", "✗", "✓"],
                                ["iOS/Android app", "✓", "✗", "✓", "✓", "✓"],
                                ["5-minute setup", "✓", "✗", "✗", "✗", "✗"],
                                ["Price (AUD/mo approx)", "See app", "$30–$150", "Not AU", "$60–$400", "$150–$450+"],
                            ].map(([feature, ...values], i) => (
                                <tr key={i} className="border-b-2 border-black last:border-0">
                                    <td className="p-3 font-bold">{feature}</td>
                                    {values.map((v, j) => (
                                        <td key={j} className={`p-3 ${v === "✓" ? "text-green-600 font-bold" : v === "✗" ? "text-red-600" : "text-yellow-600"}`}>{v}</td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <h2>The Verdict</h2>
                <p><strong>For Australian tradies and small service businesses:</strong> Flynn AI is the only self-serve, mobile-native option that works with Australian carriers, sends booking links (not just texts), and costs less than a human answering service. If you want human answering during business hours and can afford $60–$400/month, OfficeHQ is worth considering as a complement. Every other option on this list is either US-only or overkill for a solo operator.</p>

                <SmartStoreCTA
                    headline="The Only Missed Call App Built for Australian Tradies"
                    body="Flynn works with Telstra, Optus, and Vodafone. Sends instant booking and quote links. iOS and Android. 5-minute setup."
                />
            </>
        )
    },
};

export const BlogList: React.FC = () => {
    return (
        <>
            <Helmet>
                <title>Blog - Flynn AI | Insights for Service Businesses</title>
                <meta name="description" content="Tips, strategies, and guides for Australian tradies and service businesses. Learn how to stop missing calls, book more jobs, and grow your business." />
            </Helmet>

            <div className="bg-white min-h-screen pt-20 pb-20 px-6">
                <div className="max-w-7xl mx-auto text-center mb-16">
                    <h1 className="text-6xl md:text-8xl font-bold font-display text-black mb-6 tracking-tighter">
                        The <span className="text-brand-500">Dispatch.</span>
                    </h1>
                    <p className="text-xl text-gray-600 max-w-2xl mx-auto font-medium">
                        Insights, strategies, and guides for the modern tradesperson.
                    </p>
                </div>

                <div className="max-w-4xl mx-auto grid gap-12">
                    {Object.entries(blogPosts).map(([slug, post]) => (
                        <Link key={slug} to={`/blog/${slug}`} className="group block bg-surface-50 border-2 border-transparent hover:border-black p-8 transition-all hover:shadow-[8px_8px_0px_0px_#000000]">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                <div>
                                    <div className="text-brand-500 font-bold uppercase tracking-wider text-sm mb-2">{post.category}</div>
                                    <h2 className="text-3xl font-bold font-display mb-4 group-hover:underline decoration-brand-500 underline-offset-4">{post.title}</h2>
                                    <div className="flex items-center text-gray-500 text-sm font-medium gap-4">
                                        <span className="flex items-center gap-1"><Calendar size={14} /> {post.date}</span>
                                        <span className="flex items-center gap-1"><Clock size={14} /> {post.readTime}</span>
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </>
    );
};

export const BlogPost: React.FC = () => {
    const { slug } = useParams<{ slug: string }>();
    const post = blogPosts[slug || ""];

    if (!post) {
        return <Navigate to="/blog" replace />;
    }

    const articleSchema = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": post.title,
        "description": post.description,
        "author": {
            "@type": "Organization",
            "name": "Flynn AI",
            "url": "https://flynnai.app"
        },
        "publisher": {
            "@type": "Organization",
            "name": "Flynn AI",
            "url": "https://flynnai.app"
        },
        "datePublished": post.datePublished || post.date,
        "image": post.image || "https://flynnai.app/og-image.png"
    });

    return (
        <>
            <Helmet>
                <title>{post.title} - Flynn AI Blog</title>
                <meta name="description" content={post.description} />
                <meta property="og:title" content={`${post.title} - Flynn AI`} />
                <meta property="og:description" content={post.description} />
                <meta property="og:type" content="article" />
                {post.image && <meta property="og:image" content={post.image} />}
                <script type="application/ld+json">{articleSchema}</script>
            </Helmet>

            <article className="bg-white min-h-screen pt-20 pb-32 px-6">
                <div className="max-w-3xl mx-auto">
                    <Link to="/blog" className="inline-flex items-center text-gray-500 hover:text-black font-bold uppercase tracking-wider text-sm mb-12 hover:-translate-x-1 transition-transform">
                        <ArrowLeft size={16} className="mr-2" /> Back to Dispatch
                    </Link>

                    <header className="mb-12">
                        <div className="text-brand-500 font-bold uppercase tracking-wider text-sm mb-4">{post.category}</div>
                        <h1 className="text-4xl md:text-5xl font-bold font-display text-black mb-6 leading-tight">
                            {post.title}
                        </h1>
                        <div className="flex items-center text-gray-500 text-sm font-medium gap-6 border-b border-gray-100 pb-8">
                            <span className="flex items-center gap-2"><Calendar size={16} /> {post.date}</span>
                            <span className="flex items-center gap-2"><Clock size={16} /> {post.readTime}</span>
                        </div>
                    </header>

                    <div className="prose prose-lg prose-headings:font-display prose-headings:font-bold prose-a:text-brand-500 hover:prose-a:text-black">
                        {post.content}
                    </div>
                </div>
            </article>
        </>
    );
};
