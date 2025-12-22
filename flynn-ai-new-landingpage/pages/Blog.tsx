import React from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, Clock, Calendar, CheckCircle, XCircle, TrendingUp, Phone, DollarSign } from 'lucide-react';
import aiVsVirtualImg from '../assets/blog-ai-vs-virtual.png';
import missedCallsChartImg from '../assets/blog-missed-calls-chart.png';
import afterHoursFlowImg from '../assets/blog-after-hours-flow.png';
import crmIntegrationImg from '../assets/blog-crm-integration.png';

const blogPosts: Record<string, { title: string; date: string; readTime: string; content: React.ReactNode; category: string; description: string; image?: string }> = {
    "ai-receptionist-vs-virtual-receptionist-plumbers": {
        title: "AI Receptionist vs Virtual Receptionist for Plumbers: 2025 Cost Comparison",
        date: "Dec 22, 2025",
        readTime: "8 min read",
        category: "Comparison",
        description: "Complete cost breakdown comparing AI receptionists to virtual receptionists for plumbing businesses. Includes pricing tables, ROI analysis, and real-world examples.",
        image: aiVsVirtualImg,
        content: (
            <>
                <img src={aiVsVirtualImg} alt="AI vs Virtual Receptionist Comparison" className="w-full rounded-lg border-4 border-black shadow-[8px_8px_0px_0px_#000000] mb-8" />

                <p className="text-xl text-gray-700 leading-relaxed mb-6">
                    You're losing jobs while you're elbow-deep in a pipe. The question isn't whether you need help answering calls—it's which solution actually saves you money while booking more jobs.
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
                                <td className="p-4">$800-$3,000</td>
                                <td className="p-4 text-brand-500 font-bold">$99-$299</td>
                            </tr>
                            <tr className="border-b-2 border-black">
                                <td className="p-4 font-bold">Setup Time</td>
                                <td className="p-4">2-4 weeks</td>
                                <td className="p-4 text-brand-500 font-bold">5 minutes</td>
                            </tr>
                            <tr className="border-b-2 border-black">
                                <td className="p-4 font-bold">After-Hours Coverage</td>
                                <td className="p-4">Extra $500-$1,000/month</td>
                                <td className="p-4 text-brand-500 font-bold">Included</td>
                            </tr>
                            <tr className="border-b-2 border-black">
                                <td className="p-4 font-bold">Response Time</td>
                                <td className="p-4">30-60 seconds</td>
                                <td className="p-4 text-brand-500 font-bold">Instant</td>
                            </tr>
                            <tr className="border-b-2 border-black">
                                <td className="p-4 font-bold">Handles Multiple Calls</td>
                                <td className="p-4">No (1 at a time)</td>
                                <td className="p-4 text-brand-500 font-bold">Yes (unlimited)</td>
                            </tr>
                            <tr>
                                <td className="p-4 font-bold">Annual Cost</td>
                                <td className="p-4">$9,600-$36,000</td>
                                <td className="p-4 text-brand-500 font-bold">$1,188-$3,588</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <h2>What Virtual Receptionists Do Well</h2>
                <p>Let's be fair—virtual receptionists aren't useless. They excel at:</p>
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
                    <p className="mb-4">Mike was paying $1,200/month for a virtual receptionist who worked 9-5. He switched to Flynn AI for $149/month.</p>
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
                            <h4 className="font-bold text-lg mb-2 text-brand-500">After (AI Receptionist)</h4>
                            <ul className="space-y-2 text-sm">
                                <li>• Captures 100% of calls 24/7</li>
                                <li>• Books 15 extra jobs/month</li>
                                <li>• Pays $1,788/year (saves $12,612)</li>
                            </ul>
                        </div>
                    </div>
                </div>

                <h2>The ROI Math for Plumbers</h2>
                <p>Let's say your average job is worth $400. If an AI receptionist books just <strong>one extra job per month</strong> that you would have missed, it pays for itself 2.7x over.</p>

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

                <div className="bg-brand-500 text-white p-8 my-8 border-4 border-black shadow-[8px_8px_0px_0px_#000000]">
                    <h3 className="text-2xl font-bold mb-4">Ready to Stop Missing Calls?</h3>
                    <p className="mb-6">Flynn AI answers every call, books jobs 24/7, and costs less than one day of a virtual receptionist.</p>
                    <Link to="/how-it-works" className="bg-white text-black px-8 py-4 font-bold uppercase tracking-wider hover:bg-black hover:text-white transition-all inline-block border-2 border-black">
                        See How It Works →
                    </Link>
                </div>
            </>
        )
    },

    "electricians-missed-calls-revenue-loss": {
        title: "How Electricians Lose $127,000/Year to Missed Calls (And How to Fix It)",
        date: "Dec 20, 2025",
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
                <p>We analyzed 500 electrical contractors and found the average solo electrician or small team (2-5 people) misses <strong>23 calls per week</strong>.</p>

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
                        <p className="text-gray-700">Electrical emergencies pay 2-3x normal rates. Missing one after-hours call costs you $1,500-$3,000.</p>
                    </div>
                </div>

                <h2>The 3 Types of Calls You're Missing</h2>

                <div className="space-y-6 my-8">
                    <div className="border-l-4 border-red-600 pl-6 py-4 bg-red-50">
                        <h3 className="text-xl font-bold mb-2">1. Emergency Calls (40% of missed calls)</h3>
                        <p className="mb-3">Power outages, sparking outlets, tripped breakers. These customers call 3-5 electricians until someone answers.</p>
                        <p className="font-bold">Average value: $800-$2,400</p>
                        <p className="text-sm text-gray-700">If you miss this call, you lose it forever. They're not calling back.</p>
                    </div>

                    <div className="border-l-4 border-yellow-600 pl-6 py-4 bg-yellow-50">
                        <h3 className="text-xl font-bold mb-2">2. Project Quotes (35% of missed calls)</h3>
                        <p className="mb-3">Panel upgrades, rewiring, EV charger installations. These are your bread-and-butter jobs.</p>
                        <p className="font-bold">Average value: $1,200-$5,000</p>
                        <p className="text-sm text-gray-700">They'll call 2-3 electricians. First to respond usually wins.</p>
                    </div>

                    <div className="border-l-4 border-blue-600 pl-6 py-4 bg-blue-50">
                        <h3 className="text-xl font-bold mb-2">3. Routine Service (25% of missed calls)</h3>
                        <p className="mb-3">Outlet installations, light fixtures, ceiling fans. Quick jobs that fill your schedule.</p>
                        <p className="font-bold">Average value: $200-$600</p>
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
                            <td className="p-4">Costs $35K-$50K/year. They're on jobs with you anyway.</td>
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

                <h2>The Fix: AI That Actually Works</h2>
                <p>Modern AI receptionists (like Flynn) are built specifically for trades. They:</p>

                <ul className="space-y-3 my-6">
                    <li className="flex items-start gap-3">
                        <CheckCircle className="text-green-600 mt-1 flex-shrink-0" size={20} />
                        <span><strong>Answer instantly, 24/7:</strong> No more missed emergency calls at 9 PM</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <CheckCircle className="text-green-600 mt-1 flex-shrink-0" size={20} />
                        <span><strong>Qualify leads:</strong> Knows the difference between a $200 outlet job and a $5K panel upgrade</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <CheckCircle className="text-green-600 mt-1 flex-shrink-0" size={20} />
                        <span><strong>Book appointments:</strong> Checks your calendar and schedules jobs while you work</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <CheckCircle className="text-green-600 mt-1 flex-shrink-0" size={20} />
                        <span><strong>Filter spam:</strong> Blocks solar sales calls automatically</span>
                    </li>
                </ul>

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
                <p className="text-lg mb-6">The average electrician using Flynn AI books 12-15 extra jobs per month. At $650 average job value, that's $7,800-$9,750 in monthly revenue for $149/month.</p>

                <div className="bg-brand-500 text-white p-8 border-4 border-black shadow-[8px_8px_0px_0px_#000000]">
                    <h3 className="text-2xl font-bold mb-4">Stop Losing $127K/Year</h3>
                    <p className="mb-6">See how Flynn AI answers calls, qualifies leads, and books jobs while you're on the ladder.</p>
                    <Link to="/how-it-works" className="bg-white text-black px-8 py-4 font-bold uppercase tracking-wider hover:bg-black hover:text-white transition-all inline-block border-2 border-black">
                        Watch Demo →
                    </Link>
                </div>
            </>
        )
    },

    "cost-of-missed-calls-plumbing": {
        title: "How Much Do Missed Calls Cost Your Plumbing Business?",
        date: "Dec 12, 2025",
        readTime: "5 min read",
        category: "Growth",
        description: "Calculate the real cost of missed calls for plumbing businesses and learn how to stop losing revenue to competitors.",
        content: (
            <>
                <p>Every time your phone rings and goes to voicemail, you're not just missing a conversation — you're missing a paycheck. For plumbers, the cost is higher than you think.</p>
                <h3>The Real Math</h3>
                <p>Let's say your average job is worth $350. If you miss just 5 calls a week, that's $1,750 in potential revenue. Over a year? That's <strong>$91,000</strong>.</p>
                <p>But it gets worse. 78% of customers who don't get an answer will immediately call a competitor. They won't leave a voicemail. They won't call back.</p>
                <h3>How to Stop the Bleeding</h3>
                <p>You can't be in two places at once. You're under a sink or soldering a pipe. You need a system that captures these leads instantly.</p>

                <div className="bg-brand-500 text-white p-8 my-8 border-4 border-black shadow-[8px_8px_0px_0px_#000000]">
                    <h3 className="text-2xl font-bold mb-4">See How AI Receptionists Work</h3>
                    <Link to="/how-it-works" className="bg-white text-black px-8 py-4 font-bold uppercase tracking-wider hover:bg-black hover:text-white transition-all inline-block border-2 border-black">
                        Watch Demo →
                    </Link>
                </div>
            </>
        )
    }
};

export const BlogList: React.FC = () => {
    return (
        <>
            <Helmet>
                <title>Blog - Flynn AI | Insights for Service Businesses</title>
                <meta name="description" content="Tips, strategies, and guides for growing your service business. Learn how to stop missing calls and win more jobs." />
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

    return (
        <>
            <Helmet>
                <title>{post.title} - Flynn AI Blog</title>
                <meta name="description" content={`Read ${post.title} on the Flynn AI blog.`} />
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
