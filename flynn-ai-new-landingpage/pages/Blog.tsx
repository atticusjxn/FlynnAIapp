import React from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, Clock, Calendar, CheckCircle, XCircle, MessageSquare, Zap, FileText, DollarSign } from 'lucide-react';
import MessageFlynnCTA from '../components/MessageFlynnCTA';

// Small mascot banner shown near the top of each article. The mascots in
// /public/mascots are the "Flynn guy" used across the landing page.
const Hero = ({ pose }: { pose: string }) => (
    <div className="not-prose flex justify-center my-8">
        <div className="bg-surface-50 border-2 border-black w-full flex items-center justify-center py-8 shadow-[6px_6px_0px_0px_#FB5B1E]">
            <img
                src={`/mascots/${pose}.png`}
                alt="Flynn mascot"
                draggable={false}
                className="w-40 h-40 select-none pointer-events-none"
            />
        </div>
    </div>
);

const blogPosts: Record<string, { title: string; date: string; readTime: string; content: React.ReactNode; category: string; description: string; image?: string; datePublished?: string }> = {

    // ─── 1. Flagship: run your business from iMessage ─────────────────────────
    "run-your-business-from-imessage": {
        title: "How to Run Your Whole Trade Business From iMessage (2026 Guide)",
        date: "Jun 14, 2026",
        datePublished: "2026-06-14",
        readTime: "8 min read",
        category: "Guide",
        description: "You already run your day from text messages. Here's how to turn iMessage into a full business assistant that books jobs, sends invoices and chases payments.",
        content: (
            <>
                <p className="text-xl text-gray-700 leading-relaxed mb-6">
                    Think about where your business actually lives. Not in some dashboard you log into once a fortnight. It lives in your messages — the customer asking for a quote, the supplier confirming parts, your mate sending through a referral. You already run the whole thing from a thread. The problem has always been everything <em>around</em> the messages: the invoicing, the follow-ups, the bookings, the admin that piles up while you're on the tools.
                </p>

                <Hero pose="phone" />

                <p>In 2026 that gap finally closed. You can now run the back office of your business straight from a text conversation — no app to learn, no new login, no "setup wizard". You text an assistant the same way you'd text a sharp office manager, and the admin just gets handled.</p>

                <h2>Why text beats yet another app</h2>
                <p>Service operators don't abandon apps because the apps are bad. They abandon them because opening an app is friction, and friction loses every time you're standing in someone's backyard with dirty hands. Text has none of that friction. It's already open. It's where you already are. The keyboard you already use.</p>
                <p className="mt-4">There's a reason this shift is happening now. In June 2026, Apple approved the first AI agents to operate directly inside Messages for Business — a signal that texting an assistant is becoming a mainstream way to get things done, not a novelty. The behaviour was already there. The tooling finally caught up.</p>

                <h2>What "running your business from text" actually looks like</h2>
                <p>Here's a normal Tuesday, handled entirely from your message thread:</p>

                <div className="overflow-x-auto my-8">
                    <table className="w-full border-2 border-black">
                        <thead className="bg-black text-white">
                            <tr>
                                <th className="p-4 text-left font-display">You text</th>
                                <th className="p-4 text-left font-display">What gets done</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white">
                            <tr className="border-b-2 border-black">
                                <td className="p-4 font-bold">"book dave in thursday arvo for the hot water swap"</td>
                                <td className="p-4">Job added to your calendar, customer texted a confirmation.</td>
                            </tr>
                            <tr className="border-b-2 border-black">
                                <td className="p-4 font-bold">"invoice the smith job, 4 hrs + $260 parts"</td>
                                <td className="p-4">Invoice drafted with your rates and GST, sent once you say go.</td>
                            </tr>
                            <tr className="border-b-2 border-black">
                                <td className="p-4 font-bold">"what have I got on tomorrow?"</td>
                                <td className="p-4">Your day read back to you, in order, with addresses.</td>
                            </tr>
                            <tr>
                                <td className="p-4 font-bold">[forward a customer's message]</td>
                                <td className="p-4">A reply drafted in your tone, using your pricing and availability.</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <p>No tabs. No forms. You describe what you want in plain English and it happens. That's the whole idea behind <Link to="/blog/best-ai-assistant-for-tradies-2026">a text-native business assistant</Link> — the interface is a conversation, not a screen full of buttons.</p>

                <h2>The four jobs it takes off your plate</h2>

                <div className="grid md:grid-cols-2 gap-6 my-8">
                    <div className="bg-white border-2 border-black p-6">
                        <MessageSquare className="text-brand-500 mb-3" size={28} />
                        <h3 className="text-xl font-bold mb-2">Replying to leads</h3>
                        <p className="text-gray-700">A new enquiry gets a fast, on-brand reply instead of sitting unread until 8pm. Speed is the whole game — <Link to="/blog/reply-to-leads-faster-speed-to-lead">replying first usually wins the job</Link>.</p>
                    </div>
                    <div className="bg-white border-2 border-black p-6">
                        <Calendar className="text-brand-500 mb-3" size={28} />
                        <h3 className="text-xl font-bold mb-2">Booking the work</h3>
                        <p className="text-gray-700">Jobs land in your calendar from a one-line text. No double-entry, no "I thought that was next week".</p>
                    </div>
                    <div className="bg-white border-2 border-black p-6">
                        <FileText className="text-brand-500 mb-3" size={28} />
                        <h3 className="text-xl font-bold mb-2">Invoicing & quoting</h3>
                        <p className="text-gray-700">Quotes and invoices drafted from a sentence and filed into your accounting tool. More on <Link to="/blog/send-invoices-and-quotes-by-text">sending invoices by text</Link>.</p>
                    </div>
                    <div className="bg-white border-2 border-black p-6">
                        <DollarSign className="text-brand-500 mb-3" size={28} />
                        <h3 className="text-xl font-bold mb-2">Chasing money</h3>
                        <p className="text-gray-700">Overdue invoices followed up automatically, politely, so you stop <Link to="/blog/chase-unpaid-invoices-without-awkward-calls">doing the awkward chase yourself</Link>.</p>
                    </div>
                </div>

                <h2>"But will it text things on its own?"</h2>
                <p>Fair question, and the answer matters. A good text assistant never fires off anything irreversible without checking. Sending an invoice, placing a parts order, confirming a booking — it drafts it, shows you, and waits for a "yeah" before it goes. You stay in control of anything that touches a customer or your money. Everything else, the boring internal admin, it just does.</p>

                <h2>It learns your business as you go</h2>
                <p>The first week, it asks a few natural questions — your hourly rate, your usual hours, your callout fee. After that it remembers. Mention a new price mid-conversation and it's saved. Tell it a regular customer's name once and it sticks. You never fill in a profile; the business knowledge accumulates from the actual conversations you're already having.</p>

                <MessageFlynnCTA
                    headline="Run your next job from a text"
                    body="Flynn lives in iMessage. Text it like you'd text a mate who happens to run your back office — bookings, invoices, follow-ups, all handled. Nothing to install to get started."
                    mascot="phone"
                />

                <h2>How to start (it takes one message)</h2>
                <p>There's no onboarding to grind through. You send a first text — "Hi Flynn" — and it introduces itself and starts learning. Over a few exchanges it picks up your rates and how you work, and from there it's just part of your day. The app and dashboard exist for when you want them, but you never need to open anything to get value.</p>
                <p className="mt-4">That's the real unlock: the most-used tool on your phone becomes the front door to your whole business. No new habit to build. You're already texting all day — now the texting does the admin too.</p>
            </>
        )
    },

    // ─── 2. Send invoices & quotes by text ────────────────────────────────────
    "send-invoices-and-quotes-by-text": {
        title: "How to Send Invoices and Quotes by Text Message (Australia, 2026)",
        date: "Jun 10, 2026",
        datePublished: "2026-06-10",
        readTime: "7 min read",
        category: "How-To",
        description: "Stop doing invoices at 9pm. Here's how to send proper GST invoices and quotes straight from a text message, synced to Xero, without opening accounting software.",
        content: (
            <>
                <p className="text-xl text-gray-700 leading-relaxed mb-6">
                    The invoice you don't send tonight is the invoice you forget by Friday. For a lot of tradies, quoting and invoicing is the last thing standing between a finished job and getting paid, and it always happens after hours, on the couch, when you're cooked. There's a faster way: send it as a text and let an assistant turn it into a proper invoice.
                </p>

                <Hero pose="write" />

                <h2>The 9pm admin tax</h2>
                <p>Most operators lose an hour or two every night to admin they could've knocked out on site. The job's done, the customer's happy, but the invoice sits unwritten because opening accounting software means sitting down, logging in, finding the customer, typing line items, getting the GST right. So it waits. And waiting costs you — both in cash flow and in invoices that quietly never get sent.</p>

                <h2>What "invoice by text" actually means</h2>
                <p>You text a plain-English description of the job. The assistant turns it into a correctly formatted invoice — your business details, ABN, GST, line items, totals — shows it to you, and sends it to the customer once you confirm. It files a copy in your accounting tool so the books stay straight.</p>

                <div className="bg-surface-50 border-2 border-black p-8 my-8">
                    <h3 className="text-2xl font-bold mb-6">From text to invoice</h3>
                    <div className="space-y-4">
                        <div className="flex items-start gap-3">
                            <span className="font-bold text-brand-500 text-xl">1.</span>
                            <p className="m-0"><strong>You text:</strong> "invoice jenny for the bathroom job, 6 hours labour, $480 in tiles and grout"</p>
                        </div>
                        <div className="flex items-start gap-3">
                            <span className="font-bold text-brand-500 text-xl">2.</span>
                            <p className="m-0"><strong>It drafts:</strong> labour at your saved hourly rate, materials, GST added, total calculated, your ABN and details on it.</p>
                        </div>
                        <div className="flex items-start gap-3">
                            <span className="font-bold text-brand-500 text-xl">3.</span>
                            <p className="m-0"><strong>You check it</strong> and reply "send it".</p>
                        </div>
                        <div className="flex items-start gap-3">
                            <span className="font-bold text-brand-500 text-xl">4.</span>
                            <p className="m-0"><strong>Done:</strong> customer gets the invoice, a copy lands in Xero, you're back to your night.</p>
                        </div>
                    </div>
                </div>

                <h2>What makes an invoice legit in Australia</h2>
                <p>A tax invoice over $82.50 (inc GST) needs to show the seller's identity and ABN, that it's a tax invoice, the date, a description of what was sold, the GST amount (or that the total includes GST), and the buyer's details for invoices over $1,000. The point of sending by text isn't to skip any of that — it's that the assistant fills it all in correctly so you don't have to remember the rules each time.</p>

                <h2>Quotes work the same way</h2>
                <p>Before the job, text the scope and the assistant drafts a quote you can send in seconds — itemised, GST-inclusive, in your business name. When the customer says yes, that quote can roll straight into a booking and later an invoice, so you're never retyping the same details three times.</p>

                <div className="overflow-x-auto my-8">
                    <table className="w-full border-2 border-black">
                        <thead className="bg-black text-white">
                            <tr>
                                <th className="p-4 text-left font-display">The old way</th>
                                <th className="p-4 text-left font-display">By text</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white">
                            <tr className="border-b-2 border-black">
                                <td className="p-4">Log into accounting app, find customer, type line items</td>
                                <td className="p-4">One text describing the job</td>
                            </tr>
                            <tr className="border-b-2 border-black">
                                <td className="p-4">Done at 9pm if you remember</td>
                                <td className="p-4">Done in the ute before you drive off</td>
                            </tr>
                            <tr>
                                <td className="p-4">Manually re-enter into the books later</td>
                                <td className="p-4">Synced to Xero automatically</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <MessageFlynnCTA
                    headline="Send your next invoice as a text"
                    body="Describe the job, Flynn drafts a proper GST invoice, you tap send. It even files the copy in Xero for you. No accounting software open, no late-night admin."
                    mascot="write"
                />

                <h2>The bit that actually matters: getting paid</h2>
                <p>Sending faster is only half of it. The invoices that go out the same day get paid sooner, and the ones that slip get followed up — which is where <Link to="/blog/chase-unpaid-invoices-without-awkward-calls">automatic payment chasing</Link> comes in. Together they close the loop: quote by text, book by text, invoice by text, get paid without nagging anyone yourself. It all rolls up into the bigger picture of <Link to="/blog/run-your-business-from-imessage">running the whole business from your messages</Link>.</p>
            </>
        )
    },

    // ─── 3. Best AI assistant for tradies 2026 ────────────────────────────────
    "best-ai-assistant-for-tradies-2026": {
        title: "The Best AI Assistant for Tradies in 2026 (An Honest Comparison)",
        date: "Jun 6, 2026",
        datePublished: "2026-06-06",
        readTime: "8 min read",
        category: "Comparison",
        description: "Comparing the real options for an AI assistant for tradies in 2026 — generic chatbots, job-management apps and text-native agents. What actually saves you time on the tools.",
        content: (
            <>
                <p className="text-xl text-gray-700 leading-relaxed mb-6">
                    "AI assistant for tradies" covers wildly different things in 2026, and most of them won't survive contact with a real work week. Here's an honest look at the options, what each is genuinely good at, and where they fall down when you're actually busy.
                </p>

                <Hero pose="thinking" />

                <h2>The three kinds of "AI assistant" you'll run into</h2>
                <p>They're not the same product wearing different logos. They're three different bets on how you'll use them.</p>

                <h3>1. Generic chatbots (ChatGPT and friends)</h3>
                <p>Brilliant for drafting a tricky customer email or explaining a regulation. But they don't know your rates, your calendar, or your customers, and they can't <em>do</em> anything — they can't send the invoice or book the job. You're still the one copying the answer into the real tool. Great thinking partner, not an assistant that takes work off your plate.</p>

                <h3>2. Job-management apps with "AI features"</h3>
                <p>Powerful and thorough — scheduling, invoicing, quoting, the lot. The catch is they're apps. They demand setup, data entry, and that you actually open them between jobs. Plenty of tradies pay for one and use a fraction of it because the friction of logging in beats the benefit when you're flat out.</p>

                <h3>3. Text-native agents</h3>
                <p>The newer category: an assistant that lives in your messages, knows your business, and actually executes — books the job, drafts the invoice, chases the payment — from a plain text. No app to open. This is the <Link to="/blog/run-your-business-from-imessage">"run your business from iMessage"</Link> approach.</p>

                <h2>Side by side</h2>
                <div className="overflow-x-auto my-8">
                    <table className="w-full border-2 border-black text-sm">
                        <thead className="bg-black text-white">
                            <tr>
                                <th className="p-3 text-left font-display">What matters</th>
                                <th className="p-3 text-left font-display">Generic chatbot</th>
                                <th className="p-3 text-left font-display">Job-mgmt app</th>
                                <th className="p-3 text-left font-display">Text-native agent</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white">
                            <tr className="border-b-2 border-black">
                                <td className="p-3 font-bold">Knows your rates & customers</td>
                                <td className="p-3"><XCircle className="text-red-500" size={18} /></td>
                                <td className="p-3"><CheckCircle className="text-green-600" size={18} /></td>
                                <td className="p-3"><CheckCircle className="text-green-600" size={18} /></td>
                            </tr>
                            <tr className="border-b-2 border-black">
                                <td className="p-3 font-bold">Actually sends/books things</td>
                                <td className="p-3"><XCircle className="text-red-500" size={18} /></td>
                                <td className="p-3"><CheckCircle className="text-green-600" size={18} /></td>
                                <td className="p-3"><CheckCircle className="text-green-600" size={18} /></td>
                            </tr>
                            <tr className="border-b-2 border-black">
                                <td className="p-3 font-bold">No app to open</td>
                                <td className="p-3"><XCircle className="text-red-500" size={18} /></td>
                                <td className="p-3"><XCircle className="text-red-500" size={18} /></td>
                                <td className="p-3"><CheckCircle className="text-green-600" size={18} /></td>
                            </tr>
                            <tr>
                                <td className="p-3 font-bold">Works the way you already work</td>
                                <td className="p-3">Partly</td>
                                <td className="p-3"><XCircle className="text-red-500" size={18} /></td>
                                <td className="p-3"><CheckCircle className="text-green-600" size={18} /></td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <h2>What to actually look for</h2>
                <div className="grid md:grid-cols-3 gap-6 my-8">
                    <div className="bg-white border-2 border-black p-6 text-center">
                        <Zap className="text-brand-500 mx-auto mb-2" size={28} />
                        <div className="font-bold">It does, not just suggests</div>
                        <p className="text-sm text-gray-600 mt-2">If you still have to do the task yourself afterwards, it's a search engine, not an assistant.</p>
                    </div>
                    <div className="bg-white border-2 border-black p-6 text-center">
                        <MessageSquare className="text-brand-500 mx-auto mb-2" size={28} />
                        <div className="font-bold">Zero setup friction</div>
                        <p className="text-sm text-gray-600 mt-2">If using it means opening an app between jobs, you won't. Be honest with yourself.</p>
                    </div>
                    <div className="bg-white border-2 border-black p-6 text-center">
                        <CheckCircle className="text-brand-500 mx-auto mb-2" size={28} />
                        <div className="font-bold">Confirms before it acts</div>
                        <p className="text-sm text-gray-600 mt-2">Nothing irreversible — invoices, orders — should go out without your okay.</p>
                    </div>
                </div>

                <h2>The honest verdict</h2>
                <p>If you want a thinking partner, a generic chatbot is fine and cheap. If you run a bigger crew and live in a back office, a full job-management app earns its keep. But if you're a solo operator or small team who runs the whole show from your phone, the text-native agent is the one you'll actually keep using — because the bar for using it is "send a text", and you were going to do that anyway.</p>

                <MessageFlynnCTA
                    headline="Try the text-native option"
                    body="Flynn is an AI business assistant that lives in iMessage. It knows your rates, books your jobs, sends your invoices and chases your payments — from a text. See if it fits how you actually work."
                    mascot="thumbsup"
                />

                <p>Whichever way you lean, the test is the same: a week from now, are you still using it? The tools that win for tradies are the ones that disappear into how you already work. For most, that's <Link to="/blog/send-invoices-and-quotes-by-text">texting an invoice</Link> instead of opening software — and never thinking about the assistant at all.</p>
            </>
        )
    },

    // ─── 4. Chase unpaid invoices ─────────────────────────────────────────────
    "chase-unpaid-invoices-without-awkward-calls": {
        title: "How to Chase Unpaid Invoices Without the Awkward Phone Calls",
        date: "Jun 2, 2026",
        datePublished: "2026-06-02",
        readTime: "6 min read",
        category: "How-To",
        description: "Late-paying clients drain your cash flow and your weekend. Here's a calm, automatic way to chase unpaid invoices by text — no awkward phone calls, no nagging.",
        content: (
            <>
                <p className="text-xl text-gray-700 leading-relaxed mb-6">
                    Everyone hates the chase. You did the work, the invoice is sitting there 30 days overdue, and now you've got to ring someone and ask for money you've already earned. So most tradies put it off, the invoice ages, and the cash you're owed quietly becomes cash you're probably not getting. There's a better way to handle it — calm, automatic, and no phone call required.
                </p>

                <Hero pose="point" />

                <h2>Why chasing is so brutal (and why it shouldn't be)</h2>
                <p>Late payment is the number one cash-flow killer for small operators. The money's real, the work's done, but the follow-up feels personal — like you're hassling someone. So it gets skipped. The fix isn't to grow a thicker skin. It's to take yourself out of the awkward part entirely and let a system send the polite, consistent reminders that actually get invoices paid.</p>

                <h2>The follow-up ladder that works</h2>
                <p>Chasing works when it's consistent and unemotional. A simple sequence, sent automatically, beats a stressed phone call every time:</p>

                <div className="space-y-4 my-8">
                    <div className="bg-white border-2 border-black p-5 flex items-start gap-4">
                        <span className="bg-brand-500 text-white font-bold px-3 py-1 flex-shrink-0">Day 0</span>
                        <p className="m-0">Invoice sent, with a clear due date. Clarity up front prevents half the late payments.</p>
                    </div>
                    <div className="bg-white border-2 border-black p-5 flex items-start gap-4">
                        <span className="bg-brand-500 text-white font-bold px-3 py-1 flex-shrink-0">Due +1</span>
                        <p className="m-0">A friendly nudge: "Hey, just a heads up that invoice #102 was due yesterday — easy to miss, no stress." Most people pay right here.</p>
                    </div>
                    <div className="bg-white border-2 border-black p-5 flex items-start gap-4">
                        <span className="bg-brand-500 text-white font-bold px-3 py-1 flex-shrink-0">Day +7</span>
                        <p className="m-0">A slightly firmer reminder with the payment link again. Still polite, still automatic.</p>
                    </div>
                    <div className="bg-white border-2 border-black p-5 flex items-start gap-4">
                        <span className="bg-brand-500 text-white font-bold px-3 py-1 flex-shrink-0">Day +14</span>
                        <p className="m-0">A final notice that flags it to you so you can decide whether to make the rare phone call.</p>
                    </div>
                </div>

                <p>The magic is that you didn't send any of those. They went out on schedule, in a consistent tone, while you were on the tools. You only get pulled in for the genuine stragglers — which, after a couple of automatic nudges, there are far fewer of.</p>

                <h2>Why text beats email for this</h2>
                <p>Invoices emailed into a busy inbox get buried. A text gets read. A reminder that arrives as a message — short, friendly, with the amount and a way to pay — is far harder to ignore and far easier to action on the spot. That's the same reason <Link to="/blog/reply-to-leads-faster-speed-to-lead">leads convert better by text too</Link>.</p>

                <div className="grid md:grid-cols-3 gap-6 my-8">
                    <div className="bg-white border-2 border-black p-6 text-center">
                        <div className="text-3xl font-bold text-brand-500 mb-1">0</div>
                        <div className="text-sm font-medium">awkward phone calls you make</div>
                    </div>
                    <div className="bg-white border-2 border-black p-6 text-center">
                        <div className="text-3xl font-bold text-brand-500 mb-1">Auto</div>
                        <div className="text-sm font-medium">reminders sent on schedule</div>
                    </div>
                    <div className="bg-white border-2 border-black p-6 text-center">
                        <div className="text-3xl font-bold text-brand-500 mb-1">Faster</div>
                        <div className="text-sm font-medium">cash in your account</div>
                    </div>
                </div>

                <MessageFlynnCTA
                    headline="Let Flynn do the chasing"
                    body="Flynn tracks who hasn't paid and sends polite, well-timed reminders for you — so you get paid without the awkward call. You just see the money land."
                    mascot="point"
                />

                <h2>Keep your tone, keep your customers</h2>
                <p>The worry with automating follow-ups is sounding like a debt collector. Done right, it's the opposite — the reminders read like you wrote them, friendly and human, because they're tuned to your voice. Customers get a gentle nudge, not a threat, and you keep the relationship intact while still getting paid. Pair it with <Link to="/blog/send-invoices-and-quotes-by-text">sending invoices by text</Link> the day the job's done, and your whole cash-flow problem mostly takes care of itself.</p>
            </>
        )
    },

    // ─── 5. Speed to lead ─────────────────────────────────────────────────────
    "reply-to-leads-faster-speed-to-lead": {
        title: "Why Replying to Leads in 5 Minutes Wins You More Jobs",
        date: "May 28, 2026",
        datePublished: "2026-05-28",
        readTime: "6 min read",
        category: "Growth",
        description: "The first tradie to reply usually gets the job. Here's the data on speed-to-lead and how to reply to every enquiry in minutes by text, even when you're on the tools.",
        content: (
            <>
                <p className="text-xl text-gray-700 leading-relaxed mb-6">
                    Here's the uncomfortable truth about winning more work: it's rarely the cheapest quote or the slickest website that gets the job. It's whoever replies first. When someone needs a tradie, they message three or four, and they book the one who gets back to them while the problem is still fresh. Speed-to-lead is the most underrated lever in a service business.
                </p>

                <Hero pose="phone" />

                <h2>The five-minute window</h2>
                <p>Study after study of inbound leads lands on the same finding: responding within five minutes dramatically outperforms responding even an hour later. After the first hour, the odds of converting a lead drop off a cliff. People move on. They've already messaged your competitor, gotten a reply, and started booking. The enquiry that felt urgent at 9am is dead by lunch.</p>

                <div className="bg-surface-50 border-2 border-black p-8 my-8">
                    <h3 className="text-2xl font-bold mb-4">The cost of a slow reply</h3>
                    <p className="m-0">Say you get 10 enquiries a week and reply quickly to half of them. The other five drift because you were on a roof. If even three of those would've booked at a $300 average job, that's <strong>$900 a week</strong> walking to whoever answered faster — roughly <strong>$45,000 a year</strong> in work you never lost on price. You lost it on silence.</p>
                </div>

                <h2>Why tradies reply slowly (it's not laziness)</h2>
                <p>You can't text a quote back while you're under a sink or up a ladder. By the time you check your phone, it's hours later and three other people have replied. It's not a discipline problem — it's a physics problem. You physically can't be on the tools and on the phone at the same time. So the enquiries pile up and the fast money leaks out.</p>

                <h2>The fix: an assistant that replies instantly, in your voice</h2>
                <p>The answer isn't to check your phone more. It's to have something reply for you the moment an enquiry lands — fast, on-brand, using your real pricing and availability — so the lead feels looked after within minutes instead of hours. When you surface from the job, the conversation's already warm and half-qualified.</p>

                <div className="overflow-x-auto my-8">
                    <table className="w-full border-2 border-black">
                        <thead className="bg-black text-white">
                            <tr>
                                <th className="p-4 text-left font-display">Reply time</th>
                                <th className="p-4 text-left font-display">What the customer thinks</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white">
                            <tr className="border-b-2 border-black">
                                <td className="p-4 font-bold">Within 5 min</td>
                                <td className="p-4">"These guys are on it. I'll go with them."</td>
                            </tr>
                            <tr className="border-b-2 border-black">
                                <td className="p-4 font-bold">A few hours</td>
                                <td className="p-4">"Already booked someone else, sorry."</td>
                            </tr>
                            <tr>
                                <td className="p-4 font-bold">Next day</td>
                                <td className="p-4">No reply. They're gone.</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <MessageFlynnCTA
                    headline="Never be the slow one again"
                    body="Flynn replies to new enquiries fast, in your tone, with your pricing — even while you're on the tools. You win the jobs you used to lose to whoever answered first."
                    mascot="phone"
                />

                <h2>Speed is only step one</h2>
                <p>Winning the reply is the start. The same assistant that answers fast can <Link to="/blog/send-invoices-and-quotes-by-text">send the quote</Link>, book the job into your calendar, and later <Link to="/blog/chase-unpaid-invoices-without-awkward-calls">chase the payment</Link> — so a fast reply turns into a booked, invoiced, paid job without you touching the admin. That's the whole point of <Link to="/blog/run-your-business-from-imessage">running your business from your messages</Link>: the moment a lead arrives, the machine starts working, and you stay on the tools.</p>
            </>
        )
    },
};

export const BlogList: React.FC = () => {
    return (
        <>
            <Helmet>
                <title>Blog - Flynn AI | Run Your Business From Text</title>
                <meta name="description" content="Guides for tradies and service businesses on running the admin from your messages — booking jobs, sending invoices and quotes by text, chasing payments and winning more leads." />
            </Helmet>

            <div className="bg-white min-h-screen pt-20 pb-20 px-6">
                <div className="max-w-7xl mx-auto text-center mb-16">
                    <h1 className="text-6xl md:text-8xl font-bold font-display text-black mb-6 tracking-tighter">
                        The <span className="text-brand-500">Dispatch.</span>
                    </h1>
                    <p className="text-xl text-gray-600 max-w-2xl mx-auto font-medium">
                        How to run your whole business from a text message.
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
