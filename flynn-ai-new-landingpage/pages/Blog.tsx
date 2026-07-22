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
                    Think about where your business actually lives. Not in some dashboard you log into once a fortnight. It lives in your messages, the customer asking for a quote, the supplier confirming parts, your mate sending through a referral. You already run the whole thing from a thread. The problem has always been everything <em>around</em> the messages: the invoicing, the follow-ups, the bookings, the admin that piles up while you're on the tools.
                </p>

                <Hero pose="phone" />

                <p>In 2026 that gap finally closed. You can now run the back office of your business straight from a text conversation, no app to learn, no new login, no "setup wizard". You text an assistant the same way you'd text a sharp office manager, and the admin just gets handled.</p>

                <h2>Why text beats yet another app</h2>
                <p>Service operators don't abandon apps because the apps are bad. They abandon them because opening an app is friction, and friction loses every time you're standing in someone's backyard with dirty hands. Text has none of that friction. It's already open. It's where you already are. The keyboard you already use.</p>
                <p className="mt-4">There's a reason this shift is happening now. In June 2026, Apple approved the first AI agents to operate directly inside Messages for Business, a signal that texting an assistant is becoming a mainstream way to get things done, not a novelty. The behaviour was already there. The tooling finally caught up.</p>

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

                <p>No tabs. No forms. You describe what you want in plain English and it happens. That's the whole idea behind <Link to="/blog/best-ai-assistant-for-tradies-2026">a text-first business assistant</Link>, the interface is a conversation, not a screen full of buttons.</p>

                <h2>The four jobs it takes off your plate</h2>

                <div className="grid md:grid-cols-2 gap-6 my-8">
                    <div className="bg-white border-2 border-black p-6">
                        <MessageSquare className="text-brand-500 mb-3" size={28} />
                        <h3 className="text-xl font-bold mb-2">Replying to leads</h3>
                        <p className="text-gray-700">A new enquiry gets a fast, on-brand reply instead of sitting unread until 8pm. Speed is the whole game, <Link to="/blog/reply-to-leads-faster-speed-to-lead">replying first usually wins the job</Link>.</p>
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
                <p>Fair question, and the answer matters. A good text assistant never fires off anything irreversible without checking. Sending an invoice, placing a parts order, confirming a booking, it drafts it, shows you, and waits for a "yeah" before it goes. You stay in control of anything that touches a customer or your money. Everything else, the boring internal admin, it just does.</p>

                <h2>It learns your business as you go</h2>
                <p>The first week, it asks a few natural questions, your hourly rate, your usual hours, your callout fee. After that it remembers. Mention a new price mid-conversation and it's saved. Tell it a regular customer's name once and it sticks. You never fill in a profile; the business knowledge accumulates from the actual conversations you're already having.</p>

                <MessageFlynnCTA
                    headline="Run your next job from a text"
                    body="Flynn lives in iMessage. Text it like you'd text a mate who happens to run your back office, bookings, invoices, follow-ups, all handled. Nothing to install to get started."
                    mascot="phone"
                />

                <h2>How to start (it takes one message)</h2>
                <p>There's no onboarding to grind through. You send a first text. "Hi Flynn". It introduces itself and starts learning. Over a few exchanges it picks up your rates and how you work, and from there it's just part of your day. The app and dashboard exist for when you want them, but you never need to open anything to get value.</p>
                <p className="mt-4">That's the real unlock: the most-used tool on your phone becomes the front door to your whole business. No new habit to build. You're already texting all day, now the texting does the admin too.</p>
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
                <p>Most operators lose an hour or two every night to admin they could've knocked out on site. The job's done, the customer's happy, but the invoice sits unwritten because opening accounting software means sitting down, logging in, finding the customer, typing line items, getting the GST right. So it waits. And waiting costs you, both in cash flow and in invoices that quietly never get sent.</p>

                <h2>What "invoice by text" actually means</h2>
                <p>You text a plain English description of the job. The assistant turns it into a correctly formatted invoice. Your business details, ABN, GST, line items and totals, all filled in. It shows you the draft, then sends it to the customer once you confirm. A copy goes into your accounting tool so the books stay straight.</p>

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
                <p>A tax invoice over $82.50 (inc GST) needs to show the seller's identity and ABN, that it's a tax invoice, the date, a description of what was sold, the GST amount (or that the total includes GST), and the buyer's details for invoices over $1,000. The point of sending by text isn't to skip any of that, it's that the assistant fills it all in correctly so you don't have to remember the rules each time.</p>

                <h2>Quotes work the same way</h2>
                <p>Before the job, text the scope and the assistant drafts a quote you can send in seconds. Itemised, GST included, in your business name. When the customer says yes, that quote can roll straight into a booking and later an invoice, so you're never retyping the same details three times.</p>

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
                <p>Sending faster is only half of it. The invoices that go out the same day get paid sooner, and the ones that slip get followed up, which is where <Link to="/blog/chase-unpaid-invoices-without-awkward-calls">automatic payment chasing</Link> comes in. Together they close the loop: quote by text, book by text, invoice by text, get paid without nagging anyone yourself. It all rolls up into the bigger picture of <Link to="/blog/run-your-business-from-imessage">running the whole business from your messages</Link>.</p>
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
        description: "Comparing the real options for an AI assistant for tradies in 2026, generic chatbots, job management apps and text-first agents. What actually saves you time on the tools.",
        content: (
            <>
                <p className="text-xl text-gray-700 leading-relaxed mb-6">
                    "AI assistant for tradies" covers wildly different things in 2026, and most of them won't survive contact with a real work week. Here's an honest look at the options, what each is genuinely good at, and where they fall down when you're actually busy.
                </p>

                <Hero pose="thinking" />

                <h2>The three kinds of "AI assistant" you'll run into</h2>
                <p>They're not the same product wearing different logos. They're three different bets on how you'll use them.</p>

                <h3>1. Generic chatbots (ChatGPT and friends)</h3>
                <p>Brilliant for drafting a tricky customer email or explaining a regulation. But they don't know your rates, your calendar, or your customers, and they can't <em>do</em> anything, they can't send the invoice or book the job. You're still the one copying the answer into the real tool. Great thinking partner, not an assistant that takes work off your plate.</p>

                <h3>2. Job-management apps with "AI features"</h3>
                <p>Powerful and thorough, scheduling, invoicing, quoting, the lot. The catch is they're apps. They demand setup, data entry, and that you actually open them between jobs. Plenty of tradies pay for one and use a fraction of it because the friction of logging in beats the benefit when you're flat out.</p>

                <h3>3. Text-native agents</h3>
                <p>The newer category: an assistant that lives in your messages, knows your business, and actually executes. It books the job, drafts the invoice and chases the payment, all from a plain text. No app to open. This is the <Link to="/blog/run-your-business-from-imessage">"run your business from iMessage"</Link> approach.</p>

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
                        <p className="text-sm text-gray-600 mt-2">Nothing irreversible, like invoices or orders, should go out without your okay.</p>
                    </div>
                </div>

                <h2>The honest verdict</h2>
                <p>If you want a thinking partner, a generic chatbot is fine and cheap. If you run a bigger crew and live in a back office, a full job management app earns its keep. But if you're a solo operator or small team who runs the whole show from your phone, the text-first agent is the one you'll actually keep using, because the bar for using it is "send a text", and you were going to do that anyway.</p>

                <MessageFlynnCTA
                    headline="Try the text-first option"
                    body="Flynn is an AI business assistant that lives in iMessage. It knows your rates, books your jobs, sends your invoices and chases your payments, from a text. See if it fits how you actually work."
                    mascot="thumbsup"
                />

                <p>Whichever way you lean, the test is the same: a week from now, are you still using it? The tools that win for tradies are the ones that disappear into how you already work. For most, that's <Link to="/blog/send-invoices-and-quotes-by-text">texting an invoice</Link> instead of opening software, and never thinking about the assistant at all.</p>
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
        description: "Late-paying clients drain your cash flow and your weekend. Here's a calm, automatic way to chase unpaid invoices by text, no awkward phone calls, no nagging.",
        content: (
            <>
                <p className="text-xl text-gray-700 leading-relaxed mb-6">
                    Everyone hates the chase. You did the work, the invoice is sitting there 30 days overdue, and now you've got to ring someone and ask for money you've already earned. So most tradies put it off, the invoice ages, and the cash you're owed quietly becomes cash you're probably not getting. There's a better way to handle it, calm, automatic, and no phone call required.
                </p>

                <Hero pose="point" />

                <h2>Why chasing is so brutal (and why it shouldn't be)</h2>
                <p>Late payment is the number one cash flow killer for small operators. The money's real, the work's done, but the follow-up feels personal, like you're hassling someone. So it gets skipped. The fix isn't to grow a thicker skin. It's to take yourself out of the awkward part entirely and let a system send the polite, consistent reminders that actually get invoices paid.</p>

                <h2>The follow-up ladder that works</h2>
                <p>Chasing works when it's consistent and unemotional. A simple sequence, sent automatically, beats a stressed phone call every time:</p>

                <div className="space-y-4 my-8">
                    <div className="bg-white border-2 border-black p-5 flex items-start gap-4">
                        <span className="bg-brand-500 text-white font-bold px-3 py-1 flex-shrink-0">Day 0</span>
                        <p className="m-0">Invoice sent, with a clear due date. Clarity up front prevents half the late payments.</p>
                    </div>
                    <div className="bg-white border-2 border-black p-5 flex items-start gap-4">
                        <span className="bg-brand-500 text-white font-bold px-3 py-1 flex-shrink-0">Due +1</span>
                        <p className="m-0">A friendly nudge: "Hey, just a heads up that invoice #102 was due yesterday, easy to miss, no stress." Most people pay right here.</p>
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

                <p>The magic is that you didn't send any of those. They went out on schedule, in a consistent tone, while you were on the tools. You only get pulled in for the genuine stragglers, which, after a couple of automatic nudges, there are far fewer of.</p>

                <h2>Why text beats email for this</h2>
                <p>Invoices emailed into a busy inbox get buried. A text gets read. A reminder that arrives as a message, short, friendly, with the amount and a way to pay, is far harder to ignore and far easier to action on the spot. That's the same reason <Link to="/blog/reply-to-leads-faster-speed-to-lead">leads convert better by text too</Link>.</p>

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
                    body="Flynn tracks who hasn't paid and sends polite, well-timed reminders for you, so you get paid without the awkward call. You just see the money land."
                    mascot="point"
                />

                <h2>Keep your tone, keep your customers</h2>
                <p>The worry with automating follow-ups is sounding like a debt collector. Done right, it's the opposite, the reminders read like you wrote them, friendly and human, because they're tuned to your voice. Customers get a gentle nudge, not a threat, and you keep the relationship intact while still getting paid. Pair it with <Link to="/blog/send-invoices-and-quotes-by-text">sending invoices by text</Link> the day the job's done, and your whole cash flow problem mostly takes care of itself.</p>
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
                    <p className="m-0">Say you get 10 enquiries a week and reply quickly to half of them. The other five drift because you were on a roof. If even three of those would've booked at a $300 average job, that's <strong>$900 a week</strong> walking to whoever answered faster, roughly <strong>$45,000 a year</strong> in work you never lost on price. You lost it on silence.</p>
                </div>

                <h2>Why tradies reply slowly (it's not laziness)</h2>
                <p>You can't text a quote back while you're under a sink or up a ladder. By the time you check your phone, it's hours later and three other people have replied. It's not a discipline problem, it's a physics problem. You physically can't be on the tools and on the phone at the same time. So the enquiries pile up and the fast money leaks out.</p>

                <h2>The fix: an assistant that replies instantly, in your voice</h2>
                <p>The answer isn't to check your phone more. It's to have something reply for you the moment an enquiry lands, fast, on-brand, using your real pricing and availability, so the lead feels looked after within minutes instead of hours. When you surface from the job, the conversation's already warm and half-qualified.</p>

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
                    body="Flynn replies to new enquiries fast, in your tone, with your pricing, even while you're on the tools. You win the jobs you used to lose to whoever answered first."
                    mascot="phone"
                />

                <h2>Speed is only step one</h2>
                <p>Winning the reply is the start. The same assistant that answers fast can <Link to="/blog/send-invoices-and-quotes-by-text">send the quote</Link>, book the job into your calendar, and later <Link to="/blog/chase-unpaid-invoices-without-awkward-calls">chase the payment</Link>, so a fast reply turns into a booked, invoiced, paid job without you touching the admin. That's the whole point of <Link to="/blog/run-your-business-from-imessage">running your business from your messages</Link>: the moment a lead arrives, the machine starts working, and you stay on the tools.</p>
            </>
        )
    },

    // ─── W1.1 Send an invoice from your phone ─────────────────────────────────
    "send-invoice-from-your-phone": {
        title: "How to Send an Invoice From Your Phone (No Laptop Needed)",
        date: "Jun 16, 2026",
        datePublished: "2026-06-16",
        readTime: "6 min read",
        category: "How-To",
        description: "You don't need to sit down at a laptop to invoice a client. Here are the fastest ways to send a proper GST invoice straight from your phone, including by text.",
        content: (
            <>
                <p className="text-xl text-gray-700 leading-relaxed mb-6">
                    The job's done, the client's happy, and the last thing you want is to drive home and open a laptop to get paid. Good news: you can send a proper invoice from your phone in under a minute. Here's how, from slowest to fastest.
                </p>

                <Hero pose="write" />

                <h2>Option 1: Your accounting app on mobile</h2>
                <p>Xero, MYOB and QuickBooks all have phone apps. They work, but they're built for the desktop first. You log in, find the customer, tap through line items, set the tax, then send. It's fine when you're sitting down. It's fiddly with one hand on a worksite or between clients.</p>

                <h2>Option 2: A dedicated invoice app</h2>
                <p>Apps like Square or a standalone invoicing tool are quicker than full accounting software for a one-off invoice. The trade-off is another login, another subscription, and your numbers living in a second place you have to reconcile later.</p>

                <h2>Option 3: Just text it</h2>
                <p>The fastest way is to describe the job in a text and let an assistant build the invoice for you. You write one line, it formats a correct invoice with your business details, ABN and GST, shows you the draft, and sends it once you say go. A copy files into your accounting tool automatically, so the books stay straight.</p>

                <div className="bg-surface-50 border-2 border-black p-8 my-8">
                    <h3 className="text-2xl font-bold mb-4">What that looks like</h3>
                    <p className="m-0"><strong>You text:</strong> "invoice sarah for today, 3 hours plus $90 materials"</p>
                    <p className="mt-3 mb-0"><strong>You get back:</strong> a formatted invoice, labour at your saved rate, materials, GST added, total done. Reply "send" and it's gone.</p>
                </div>

                <h2>What every invoice has to include</h2>
                <p>However you send it, a valid tax invoice over $82.50 (inc GST) in Australia needs your business name and ABN, the words "tax invoice", the date, what you sold, the GST amount or a note that the total includes GST, and the buyer's details once it's over $1,000. The point of sending from your phone isn't to skip the rules, it's to have something fill them in correctly every time.</p>

                <div className="overflow-x-auto my-8">
                    <table className="w-full border-2 border-black">
                        <thead className="bg-black text-white">
                            <tr>
                                <th className="p-4 text-left font-display">Method</th>
                                <th className="p-4 text-left font-display">Time to send</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white">
                            <tr className="border-b-2 border-black"><td className="p-4 font-bold">Accounting app on mobile</td><td className="p-4">3 to 5 minutes</td></tr>
                            <tr className="border-b-2 border-black"><td className="p-4 font-bold">Dedicated invoice app</td><td className="p-4">2 to 3 minutes</td></tr>
                            <tr><td className="p-4 font-bold">By text</td><td className="p-4">Under 1 minute</td></tr>
                        </tbody>
                    </table>
                </div>

                <MessageFlynnCTA
                    headline="Invoice your next job as a text"
                    body="Describe the job, Flynn drafts a proper GST invoice and files a copy in Xero. You just tap send. No laptop, no app to open first."
                    mascot="write"
                />

                <h2>The real win is getting paid sooner</h2>
                <p>The invoice you send from the driveway gets paid days before the one waiting on your kitchen table. Send same-day, then let the follow-ups run themselves with <Link to="/blog/late-payment-reminder-templates">payment reminder templates</Link> or automatic <Link to="/blog/chase-unpaid-invoices-without-awkward-calls">invoice chasing</Link>. It all rolls into <Link to="/blog/run-small-business-from-your-phone">running the business from your phone</Link>.</p>
            </>
        )
    },

    // ─── W1.2 AI tools to run small business admin ────────────────────────────
    "ai-tools-small-business-admin": {
        title: "AI Tools to Run Your Small Business Admin in 2026",
        date: "Jun 17, 2026",
        datePublished: "2026-06-17",
        readTime: "7 min read",
        category: "Guide",
        description: "The admin that eats your evenings (invoicing, quoting, scheduling, follow-ups) is exactly what AI is now good at. Here are the tools that actually take work off your plate in 2026.",
        content: (
            <>
                <p className="text-xl text-gray-700 leading-relaxed mb-6">
                    Most "AI for business" advice is about writing blog posts. That's not your problem. Your problem is the two hours a night of invoicing, quoting, chasing payments and replying to enquiries. The good news: that admin is exactly what AI got good at in 2026. Here's what actually helps.
                </p>

                <Hero pose="thinking" />

                <h2>The jobs worth handing to AI</h2>
                <div className="grid md:grid-cols-2 gap-6 my-8">
                    <div className="bg-white border-2 border-black p-6">
                        <FileText className="text-brand-500 mb-3" size={28} />
                        <h3 className="text-xl font-bold mb-2">Invoicing & quoting</h3>
                        <p className="text-gray-700">Turn a sentence into a formatted invoice or quote. The repetitive formatting is gone.</p>
                    </div>
                    <div className="bg-white border-2 border-black p-6">
                        <DollarSign className="text-brand-500 mb-3" size={28} />
                        <h3 className="text-xl font-bold mb-2">Chasing money</h3>
                        <p className="text-gray-700">Automatic, polite reminders on overdue invoices so you stop doing it by hand.</p>
                    </div>
                    <div className="bg-white border-2 border-black p-6">
                        <MessageSquare className="text-brand-500 mb-3" size={28} />
                        <h3 className="text-xl font-bold mb-2">Replying to enquiries</h3>
                        <p className="text-gray-700">Fast, on-brand replies to new leads so you don't lose them to a faster competitor.</p>
                    </div>
                    <div className="bg-white border-2 border-black p-6">
                        <Calendar className="text-brand-500 mb-3" size={28} />
                        <h3 className="text-xl font-bold mb-2">Booking & reminders</h3>
                        <p className="text-gray-700">Jobs into your calendar and reminders to clients, without the back-and-forth.</p>
                    </div>
                </div>

                <h2>The two kinds of AI tool</h2>
                <p>There's a big difference that decides whether a tool actually saves you time.</p>
                <p className="mt-4"><strong>Assistants that suggest.</strong> A generic chatbot can draft an email or explain a rule. But it doesn't know your prices or clients, and it can't send the invoice or book the job. You still do the task. Useful, but it's a thinking partner, not an admin team.</p>
                <p className="mt-4"><strong>Agents that do.</strong> The newer category knows your business and actually executes: it sends the invoice, books the job, chases the payment, from a plain instruction. That's the difference between saving five minutes and saving the whole evening.</p>

                <h2>What to look for in 2026</h2>
                <div className="grid md:grid-cols-3 gap-6 my-8">
                    <div className="bg-white border-2 border-black p-6 text-center"><Zap className="text-brand-500 mx-auto mb-2" size={28} /><div className="font-bold">It executes</div><p className="text-sm text-gray-600 mt-2">Not just answers. It does the task end to end.</p></div>
                    <div className="bg-white border-2 border-black p-6 text-center"><CheckCircle className="text-brand-500 mx-auto mb-2" size={28} /><div className="font-bold">It confirms first</div><p className="text-sm text-gray-600 mt-2">Nothing irreversible goes out without your okay.</p></div>
                    <div className="bg-white border-2 border-black p-6 text-center"><MessageSquare className="text-brand-500 mx-auto mb-2" size={28} /><div className="font-bold">Zero setup friction</div><p className="text-sm text-gray-600 mt-2">If you have to open an app to use it, you won't.</p></div>
                </div>

                <MessageFlynnCTA
                    headline="The admin assistant that lives in your texts"
                    body="Flynn does the admin instead of suggesting it. Invoices, quotes, bookings, follow-ups, all from a text, all with your okay before anything sends."
                    mascot="thumbsup"
                />

                <h2>Where to start</h2>
                <p>Pick the one job that costs you the most time and hand that over first. For most small businesses it's invoicing or chasing payments. Get that off your plate, then add the next. If you want the whole stack in one place, see <Link to="/blog/run-small-business-from-your-phone">how to run your business from your phone</Link>, or the honest take on <Link to="/blog/chatgpt-for-small-business">ChatGPT for small business</Link>.</p>
            </>
        )
    },

    // ─── W1.3 Flynn vs Tradify / Jobber / ServiceM8 ───────────────────────────
    "flynn-vs-tradify-jobber-servicem8": {
        title: "Flynn vs Tradify, Jobber & ServiceM8: An Honest Comparison",
        date: "Jun 18, 2026",
        datePublished: "2026-06-18",
        readTime: "8 min read",
        category: "Comparison",
        description: "Tradify, Jobber and ServiceM8 are powerful job-management apps. Flynn is a text-based assistant. Here's an honest look at which suits how you actually work.",
        content: (
            <>
                <p className="text-xl text-gray-700 leading-relaxed mb-6">
                    Tradify, Jobber and ServiceM8 are good products with a lot of fans. Flynn is a different kind of thing. This is an honest look at where each fits, so you pick the one that matches how you actually run your day, not the one with the longest feature list.
                </p>

                <Hero pose="point" />

                <h2>What the job-management apps are</h2>
                <p>Tradify, Jobber and ServiceM8 are full job-management platforms. Quoting, scheduling, job tracking, invoicing, team management, the lot. If you run a crew and live in a back office or a tablet, they're genuinely powerful and worth the money.</p>
                <p className="mt-4">The catch is the same for all three: they're apps you have to open, learn, and keep fed with data. Plenty of solo operators pay for one and use a fraction of it, because opening an app between jobs is friction, and the setup is a project in itself.</p>

                <h2>What Flynn is</h2>
                <p>Flynn isn't an app you open. It's an assistant that lives in your messages. You text it like you'd text an office manager, and it does the admin: drafts and sends invoices, books jobs into your calendar, chases payments, replies to leads. It learns your prices and clients so it never asks twice. Nothing to log into between jobs.</p>

                <h2>Side by side</h2>
                <div className="overflow-x-auto my-8">
                    <table className="w-full border-2 border-black text-sm">
                        <thead className="bg-black text-white">
                            <tr>
                                <th className="p-3 text-left font-display">What matters</th>
                                <th className="p-3 text-left font-display">Job-mgmt apps</th>
                                <th className="p-3 text-left font-display">Flynn</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white">
                            <tr className="border-b-2 border-black"><td className="p-3 font-bold">Depth of features</td><td className="p-3"><CheckCircle className="text-green-600" size={18} /> Deep</td><td className="p-3">Focused on admin</td></tr>
                            <tr className="border-b-2 border-black"><td className="p-3 font-bold">App to open & learn</td><td className="p-3">Yes</td><td className="p-3"><CheckCircle className="text-green-600" size={18} /> None, it's a text</td></tr>
                            <tr className="border-b-2 border-black"><td className="p-3 font-bold">Setup effort</td><td className="p-3">Hours</td><td className="p-3"><CheckCircle className="text-green-600" size={18} /> One message</td></tr>
                            <tr className="border-b-2 border-black"><td className="p-3 font-bold">Best for big crews</td><td className="p-3"><CheckCircle className="text-green-600" size={18} /></td><td className="p-3">Solo & small teams</td></tr>
                            <tr><td className="p-3 font-bold">Best for "just handle it"</td><td className="p-3">Partly</td><td className="p-3"><CheckCircle className="text-green-600" size={18} /></td></tr>
                        </tbody>
                    </table>
                </div>

                <h2>Which should you pick</h2>
                <p>If you run a larger team, schedule lots of jobs across staff, and want one system of record, a full job-management app earns its keep. If you're a solo operator or small team who runs everything from your phone and just wants the admin to disappear, the app is overkill and you'll fight the friction. That's where a text assistant wins, because the bar to use it is "send a text".</p>
                <p className="mt-4">They're not even mutually exclusive. Flynn can sit on top of your existing tools (it files invoices into Xero, books into your calendar) and just be the fast front door you actually use.</p>

                <MessageFlynnCTA
                    headline="Try the no-app option"
                    body="Flynn handles invoices, quotes, bookings and follow-ups from a text, and files into the tools you already use. See if it fits how you actually work."
                    mascot="thumbsup"
                />

                <p>Still weighing it up? See <Link to="/blog/flynn-vs-calendly-square-booking-by-text">Flynn vs Calendly and Square for bookings</Link>, or the broader <Link to="/blog/best-ai-assistant-for-tradies-2026">best AI assistant for tradies</Link> breakdown.</p>
            </>
        )
    },

    // ─── W1.4 Flynn vs Calendly / Square ──────────────────────────────────────
    "flynn-vs-calendly-square-booking-by-text": {
        title: "Flynn vs Calendly & Square: Booking Clients by Text",
        date: "Jun 19, 2026",
        datePublished: "2026-06-19",
        readTime: "6 min read",
        category: "Comparison",
        description: "Calendly and Square Appointments use booking links. Flynn books clients straight from a text. Here's which approach gets more of your clients actually booked.",
        content: (
            <>
                <p className="text-xl text-gray-700 leading-relaxed mb-6">
                    Calendly and Square Appointments are solid booking tools. They both run on the same idea: send the client a link, let them pick a slot. Flynn works differently, it books from the conversation you're already having. Here's when each wins.
                </p>

                <Hero pose="phone" />

                <h2>The booking-link model</h2>
                <p>Calendly and Square give you a page where clients self-serve a time. It's great when the client is already keen and happy to click through. The friction shows up with the clients who aren't: the ones who text "you free thursday?" and won't go hunting through a link to find out. Some drop off right there.</p>

                <h2>The book-from-the-text model</h2>
                <p>Flynn lives in the chat. When a client texts asking about a time, you (or Flynn) just reply with what's free and book it, no link, no page, no app for them to load. For service businesses where booking happens in a back-and-forth text, that removes the step where people leak away.</p>

                <div className="overflow-x-auto my-8">
                    <table className="w-full border-2 border-black text-sm">
                        <thead className="bg-black text-white">
                            <tr>
                                <th className="p-3 text-left font-display"></th>
                                <th className="p-3 text-left font-display">Calendly / Square</th>
                                <th className="p-3 text-left font-display">Flynn</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white">
                            <tr className="border-b-2 border-black"><td className="p-3 font-bold">How clients book</td><td className="p-3">Click a link, pick a slot</td><td className="p-3">Just reply in the text</td></tr>
                            <tr className="border-b-2 border-black"><td className="p-3 font-bold">Client needs an app/page</td><td className="p-3">Yes</td><td className="p-3"><CheckCircle className="text-green-600" size={18} /> No</td></tr>
                            <tr className="border-b-2 border-black"><td className="p-3 font-bold">Self-serve scheduling page</td><td className="p-3"><CheckCircle className="text-green-600" size={18} /></td><td className="p-3">Not the focus</td></tr>
                            <tr><td className="p-3 font-bold">Also invoices, quotes, follow-ups</td><td className="p-3">No</td><td className="p-3"><CheckCircle className="text-green-600" size={18} /></td></tr>
                        </tbody>
                    </table>
                </div>

                <h2>Which fits you</h2>
                <p>If most of your bookings come from people happy to self-serve a link (consultants, demos, salons with a steady online flow), Calendly or Square do the job well. If your bookings happen in messy text conversations and you want the rest of your admin handled too, booking from the text converts more of those chats and keeps everything in one place.</p>

                <MessageFlynnCTA
                    headline="Book your next client from the text"
                    body="Flynn checks your calendar and books the job right in the conversation, then handles the invoice and reminders too. No link for your client to chase."
                    mascot="phone"
                />

                <p>More on the approach: <Link to="/blog/how-to-take-bookings-over-text">how to take bookings over text</Link>, and keep clients coming back with <Link to="/blog/customer-follow-up-text-templates">follow-up templates</Link>.</p>
            </>
        )
    },

    // ─── W1.5 ChatGPT for small business ──────────────────────────────────────
    "chatgpt-for-small-business": {
        title: "ChatGPT for Small Business: What It Can and Can't Do",
        date: "Jun 20, 2026",
        datePublished: "2026-06-20",
        readTime: "7 min read",
        category: "Guide",
        description: "ChatGPT is a brilliant thinking partner for small business owners, and useless for some of the jobs you actually need done. Here's the honest line between the two.",
        content: (
            <>
                <p className="text-xl text-gray-700 leading-relaxed mb-6">
                    ChatGPT is genuinely useful for running a small business, and genuinely oversold for some of it. Knowing the line saves you time and stops you expecting it to do things it structurally can't. Here's the honest breakdown.
                </p>

                <Hero pose="thinking" />

                <h2>What ChatGPT is great at</h2>
                <div className="grid md:grid-cols-2 gap-6 my-8">
                    <div className="bg-white border-2 border-black p-6"><CheckCircle className="text-green-600 mb-3" size={28} /><h3 className="text-xl font-bold mb-2">Writing & rewriting</h3><p className="text-gray-700">Customer emails, ad copy, a polite reply to a tricky review. First drafts in seconds.</p></div>
                    <div className="bg-white border-2 border-black p-6"><CheckCircle className="text-green-600 mb-3" size={28} /><h3 className="text-xl font-bold mb-2">Explaining things</h3><p className="text-gray-700">"What does this clause mean?", "how does GST work for a sole trader?" A patient explainer.</p></div>
                    <div className="bg-white border-2 border-black p-6"><CheckCircle className="text-green-600 mb-3" size={28} /><h3 className="text-xl font-bold mb-2">Thinking out loud</h3><p className="text-gray-700">Pricing ideas, naming, how to handle a difficult client. A sounding board on tap.</p></div>
                    <div className="bg-white border-2 border-black p-6"><CheckCircle className="text-green-600 mb-3" size={28} /><h3 className="text-xl font-bold mb-2">Summarising</h3><p className="text-gray-700">Long emails, contracts, a wall of text from a supplier, boiled down.</p></div>
                </div>

                <h2>What it can't do (by design)</h2>
                <p>This is the part the hype skips. ChatGPT doesn't know your business and can't act on it.</p>
                <ul>
                    <li><strong>It doesn't know your numbers.</strong> Your rates, your clients, your calendar. It'll happily invent a plausible price that isn't yours.</li>
                    <li><strong>It can't actually do the task.</strong> It can write an invoice in the chat, but it can't send it, file it in Xero, or book the job. You still do all of that by hand.</li>
                    <li><strong>It forgets.</strong> Tell it your callout fee today, it won't remember next week unless you set it up to.</li>
                </ul>
                <p className="mt-4">So for the admin that actually eats your time, ChatGPT gets you a draft and then hands the real work back to you.</p>

                <div className="overflow-x-auto my-8">
                    <table className="w-full border-2 border-black">
                        <thead className="bg-black text-white"><tr><th className="p-4 text-left font-display">Task</th><th className="p-4 text-left font-display">ChatGPT</th><th className="p-4 text-left font-display">A business agent</th></tr></thead>
                        <tbody className="bg-white">
                            <tr className="border-b-2 border-black"><td className="p-4">Draft a client email</td><td className="p-4"><CheckCircle className="text-green-600" size={18} /></td><td className="p-4"><CheckCircle className="text-green-600" size={18} /></td></tr>
                            <tr className="border-b-2 border-black"><td className="p-4">Actually send the invoice</td><td className="p-4"><XCircle className="text-red-500" size={18} /></td><td className="p-4"><CheckCircle className="text-green-600" size={18} /></td></tr>
                            <tr className="border-b-2 border-black"><td className="p-4">Use your real prices</td><td className="p-4"><XCircle className="text-red-500" size={18} /></td><td className="p-4"><CheckCircle className="text-green-600" size={18} /></td></tr>
                            <tr><td className="p-4">Book a job in your calendar</td><td className="p-4"><XCircle className="text-red-500" size={18} /></td><td className="p-4"><CheckCircle className="text-green-600" size={18} /></td></tr>
                        </tbody>
                    </table>
                </div>

                <MessageFlynnCTA
                    headline="When you need it done, not just drafted"
                    body="Flynn knows your prices and clients and actually executes: sends the invoice, books the job, chases the payment. From a text, with your okay first."
                    mascot="thumbsup"
                />

                <h2>Use both</h2>
                <p>Keep ChatGPT for thinking and writing. Use a business agent for the admin that needs to actually happen. For more on that split, see <Link to="/blog/ai-tools-small-business-admin">AI tools to run your small business admin</Link> and <Link to="/blog/best-ai-assistant-for-tradies-2026">the best AI assistant comparison</Link>.</p>
            </>
        )
    },

    // ─── W1.6 Customer follow-up text templates ───────────────────────────────
    "customer-follow-up-text-templates": {
        title: "12 Customer Follow-Up Text Templates (Copy & Paste)",
        date: "Jun 23, 2026",
        datePublished: "2026-06-23",
        readTime: "6 min read",
        category: "How-To",
        description: "Free, copy-and-paste text message templates for following up with customers: after a quote, after a job, for reviews, for rebooking, and for slow payers.",
        content: (
            <>
                <p className="text-xl text-gray-700 leading-relaxed mb-6">
                    Following up is where most of the money is, and it's the thing everyone forgets to do. Here are templates you can copy, tweak and send in seconds. Keep them short, friendly and human. Long, formal messages get ignored.
                </p>

                <Hero pose="write" />

                <h2>After you send a quote</h2>
                <div className="bg-surface-50 border-2 border-black p-6 my-6">
                    <p className="m-0">"Hey [name], just checking you got the quote I sent through. Happy to tweak anything or answer questions. Keen to help when you're ready."</p>
                </div>

                <h2>When a quote goes quiet (3 to 5 days)</h2>
                <div className="bg-surface-50 border-2 border-black p-6 my-6">
                    <p className="m-0">"Hi [name], no rush at all, just wanted to check the quote still suits. If the timing or price is off, tell me and we'll sort something."</p>
                </div>

                <h2>After a job is done</h2>
                <div className="bg-surface-50 border-2 border-black p-6 my-6">
                    <p className="m-0">"Thanks again [name], great working with you. Anything not quite right, just say the word. Otherwise I'll get the invoice across shortly."</p>
                </div>

                <h2>Asking for a review</h2>
                <div className="bg-surface-50 border-2 border-black p-6 my-6">
                    <p className="m-0">"Glad you're happy with it [name]. If you've got 20 seconds, a quick Google review really helps a small business like mine. Here's the link: [link]. No worries if not."</p>
                </div>

                <h2>Rebooking a past customer</h2>
                <div className="bg-surface-50 border-2 border-black p-6 my-6">
                    <p className="m-0">"Hey [name], it's been about [time] since I last sorted your [job]. Want me to book you in again before it gets busy?"</p>
                </div>

                <h2>A gentle payment nudge</h2>
                <div className="bg-surface-50 border-2 border-black p-6 my-6">
                    <p className="m-0">"Hi [name], quick heads up that invoice [#] was due [date]. Easy to miss, here's the link to sort it: [link]. Cheers."</p>
                </div>

                <h2>The two rules that make follow-ups work</h2>
                <p>First, be consistent. The follow-up you actually send beats the perfect one you don't. Second, sound like you, not a corporation. These read like a person texted, which is exactly why they get replies. If remembering to send them is the hard part, that's the bit worth automating.</p>

                <MessageFlynnCTA
                    headline="Stop remembering to follow up"
                    body="Flynn tracks your quotes and invoices and sends the follow-ups for you, in your voice, at the right time. You just see the replies and the payments land."
                    mascot="point"
                />

                <p>Related: <Link to="/blog/how-to-follow-up-on-a-quote">how to follow up on a quote without being annoying</Link> and <Link to="/blog/late-payment-reminder-templates">late payment reminder templates</Link>.</p>
            </>
        )
    },

    // ─── W1.7 How to follow up on a quote ─────────────────────────────────────
    "how-to-follow-up-on-a-quote": {
        title: "How to Follow Up on a Quote Without Being Annoying",
        date: "Jun 24, 2026",
        datePublished: "2026-06-24",
        readTime: "6 min read",
        category: "How-To",
        description: "Most quotes are won or lost in the follow-up, not the price. Here's how to chase a quote so you close more jobs without feeling pushy or desperate.",
        content: (
            <>
                <p className="text-xl text-gray-700 leading-relaxed mb-6">
                    Here's the uncomfortable stat: a big chunk of quotes never get a yes or a no. They just go quiet. And most owners never follow up because it feels pushy. That silence is costing you jobs you'd have won with one friendly nudge. Here's how to do it right.
                </p>

                <Hero pose="point" />

                <h2>Why following up feels bad (and why it shouldn't)</h2>
                <p>Chasing a quote feels like begging. It isn't. The customer asked you for a price, which means they had a problem they wanted solved. Following up is just making it easy for them to say yes. Half the time they meant to reply and life got in the way. Your nudge is a favour, not a nuisance.</p>

                <h2>The follow-up rhythm that works</h2>
                <div className="space-y-4 my-8">
                    <div className="bg-white border-2 border-black p-5 flex items-start gap-4"><span className="bg-brand-500 text-white font-bold px-3 py-1 flex-shrink-0">Day 0</span><p className="m-0">Send the quote with a clear next step. "Reply yes and I'll lock in a time."</p></div>
                    <div className="bg-white border-2 border-black p-5 flex items-start gap-4"><span className="bg-brand-500 text-white font-bold px-3 py-1 flex-shrink-0">Day 3</span><p className="m-0">Friendly check-in. "Just making sure that quote landed, happy to tweak anything."</p></div>
                    <div className="bg-white border-2 border-black p-5 flex items-start gap-4"><span className="bg-brand-500 text-white font-bold px-3 py-1 flex-shrink-0">Day 7</span><p className="m-0">Add value or a reason. "Got a gap next week if you want to get it done before [season/event]."</p></div>
                    <div className="bg-white border-2 border-black p-5 flex items-start gap-4"><span className="bg-brand-500 text-white font-bold px-3 py-1 flex-shrink-0">Day 14</span><p className="m-0">The graceful close. "All good if the timing's not right, I'll close this off, just shout when you're ready."</p></div>
                </div>
                <p>That last one works surprisingly well. Giving people an easy out often gets the yes, because it removes the pressure.</p>

                <h2>The rules</h2>
                <ul>
                    <li><strong>Two or three nudges, then stop.</strong> Persistent isn't pushy. Endless is.</li>
                    <li><strong>Always add something.</strong> A gap in the calendar, a reason to act now, an offer to adjust. Never just "any update?".</li>
                    <li><strong>Keep it short and human.</strong> A text, not a formal letter.</li>
                </ul>

                <MessageFlynnCTA
                    headline="Never let a quote go cold"
                    body="Flynn remembers every quote you send and reminds you (or follows up for you) on the right day, in your voice. More jobs closed, zero awkwardness."
                    mascot="thumbsup"
                />

                <p>Steal the wording from <Link to="/blog/customer-follow-up-text-templates">our follow-up text templates</Link>, and once they say yes, <Link to="/blog/send-invoice-from-your-phone">invoice the job from your phone</Link>.</p>
            </>
        )
    },

    // ─── W1.8 How to take bookings over text ──────────────────────────────────
    "how-to-take-bookings-over-text": {
        title: "How to Take Bookings Over Text (Without the Back-and-Forth)",
        date: "Jun 25, 2026",
        datePublished: "2026-06-25",
        readTime: "6 min read",
        category: "How-To",
        description: "Most clients would rather text than use a booking app. Here's how to take bookings over text cleanly, avoid the endless back-and-forth, and stop double-booking yourself.",
        content: (
            <>
                <p className="text-xl text-gray-700 leading-relaxed mb-6">
                    Your clients already text you. They'd rather do that than learn your booking app. The problem isn't the channel, it's the back-and-forth: "you free thursday?", "morning or arvo?", "what time?", three days later you've lost track. Here's how to take bookings over text cleanly.
                </p>

                <Hero pose="phone" />

                <h2>Why text beats a booking link for a lot of clients</h2>
                <p>Booking links are great for the keen and the tech-comfortable. But a chunk of clients won't click through, won't make an account, and just want a human answer in the thread. Forcing them to a link loses some of them. Meeting them in the text keeps them.</p>

                <h2>The three problems to solve</h2>
                <div className="grid md:grid-cols-3 gap-6 my-8">
                    <div className="bg-white border-2 border-black p-6 text-center"><Clock className="text-brand-500 mx-auto mb-2" size={28} /><div className="font-bold">The back-and-forth</div><p className="text-sm text-gray-600 mt-2">Offer two or three specific times, not "when suits?".</p></div>
                    <div className="bg-white border-2 border-black p-6 text-center"><Calendar className="text-brand-500 mx-auto mb-2" size={28} /><div className="font-bold">Double-booking</div><p className="text-sm text-gray-600 mt-2">Every text booking has to land in one calendar, instantly.</p></div>
                    <div className="bg-white border-2 border-black p-6 text-center"><CheckCircle className="text-brand-500 mx-auto mb-2" size={28} /><div className="font-bold">No-shows</div><p className="text-sm text-gray-600 mt-2">A confirmation and a reminder text cuts them right down.</p></div>
                </div>

                <h2>The clean way to do it</h2>
                <p>Offer specific times, confirm in writing, and put it straight in your calendar. Done by hand that's three steps and a chance to slip up. The faster version: an assistant reads your calendar, offers what's actually free, books it when the client says yes, and sends the confirmation, all in the same text thread.</p>

                <div className="bg-surface-50 border-2 border-black p-8 my-8">
                    <h3 className="text-2xl font-bold mb-4">In practice</h3>
                    <p className="m-0"><strong>Client:</strong> "any chance this week?"</p>
                    <p className="mt-2 mb-0"><strong>You:</strong> "I've got Thursday 9am or Friday 2pm, want one of those?"</p>
                    <p className="mt-2 mb-0"><strong>Client:</strong> "Friday's good"</p>
                    <p className="mt-2 mb-0"><strong>Done:</strong> it's in your calendar, client gets a confirmation, reminder goes out the day before.</p>
                </div>

                <MessageFlynnCTA
                    headline="Take your next booking from the text"
                    body="Flynn checks your calendar, offers real times, books the job and sends the reminder, all in the conversation. No app for your client, no double-bookings for you."
                    mascot="phone"
                />

                <p>Compare the approaches in <Link to="/blog/flynn-vs-calendly-square-booking-by-text">Flynn vs Calendly and Square</Link>, and reduce no-shows with <Link to="/blog/customer-follow-up-text-templates">reminder and rebooking templates</Link>.</p>
            </>
        )
    },

    // ─── W1.9 Late payment reminder templates ─────────────────────────────────
    "late-payment-reminder-templates": {
        title: "Late Payment Reminder Templates (Text & Email, Free)",
        date: "Jun 26, 2026",
        datePublished: "2026-06-26",
        readTime: "6 min read",
        category: "How-To",
        description: "Free copy-and-paste late payment reminder templates for text and email, from the friendly first nudge to the firm final notice, plus when to send each one.",
        content: (
            <>
                <p className="text-xl text-gray-700 leading-relaxed mb-6">
                    Getting paid late is the most common cash-flow problem in small business, and the fix is boring but reliable: consistent, polite reminders. Here are templates for each stage, plus exactly when to send them. Copy, tweak, send.
                </p>

                <Hero pose="point" />

                <h2>1. The friendly heads-up (day after due)</h2>
                <div className="bg-surface-50 border-2 border-black p-6 my-6">
                    <p className="m-0"><strong>Text:</strong> "Hi [name], quick reminder that invoice [#] for [$amount] was due yesterday. Easy to miss, here's the link to pay: [link]. Cheers!"</p>
                </div>

                <h2>2. The check-in (7 days overdue)</h2>
                <div className="bg-surface-50 border-2 border-black p-6 my-6">
                    <p className="m-0"><strong>Email:</strong> "Hi [name], just following up on invoice [#] for [$amount], now a week overdue. If you've already sent it, ignore this. If not, here's the payment link: [link]. Let me know if there's any issue."</p>
                </div>

                <h2>3. The firm reminder (14 days overdue)</h2>
                <div className="bg-surface-50 border-2 border-black p-6 my-6">
                    <p className="m-0"><strong>Email:</strong> "Hi [name], invoice [#] for [$amount] is now 14 days overdue. Could you let me know when I can expect payment? Happy to sort a plan if needed. Payment link: [link]."</p>
                </div>

                <h2>4. The final notice (30 days overdue)</h2>
                <div className="bg-surface-50 border-2 border-black p-6 my-6">
                    <p className="m-0"><strong>Email:</strong> "Hi [name], this is a final reminder on invoice [#] for [$amount], now 30 days overdue. Please arrange payment within 7 days so we can keep things on good terms. Link: [link]. Get in touch if there's a problem."</p>
                </div>

                <h2>When to send each</h2>
                <div className="overflow-x-auto my-8">
                    <table className="w-full border-2 border-black">
                        <thead className="bg-black text-white"><tr><th className="p-4 text-left font-display">Stage</th><th className="p-4 text-left font-display">Timing</th><th className="p-4 text-left font-display">Tone</th></tr></thead>
                        <tbody className="bg-white">
                            <tr className="border-b-2 border-black"><td className="p-4 font-bold">Heads-up</td><td className="p-4">Due + 1 day</td><td className="p-4">Light, no stress</td></tr>
                            <tr className="border-b-2 border-black"><td className="p-4 font-bold">Check-in</td><td className="p-4">+ 7 days</td><td className="p-4">Friendly, clear</td></tr>
                            <tr className="border-b-2 border-black"><td className="p-4 font-bold">Firm reminder</td><td className="p-4">+ 14 days</td><td className="p-4">Direct, fair</td></tr>
                            <tr><td className="p-4 font-bold">Final notice</td><td className="p-4">+ 30 days</td><td className="p-4">Firm, professional</td></tr>
                        </tbody>
                    </table>
                </div>

                <p>The secret isn't the wording, it's sending every stage on time without fail. That's the part worth taking off your plate.</p>

                <MessageFlynnCTA
                    headline="Send these on autopilot"
                    body="Flynn tracks who hasn't paid and sends the right reminder at the right time, in your voice. You stop chasing and just watch the money land."
                    mascot="point"
                />

                <p>For the bigger picture, see <Link to="/blog/chase-unpaid-invoices-without-awkward-calls">how to chase unpaid invoices without the awkward calls</Link>, and <Link to="/blog/send-invoice-from-your-phone">send the invoice from your phone</Link> the day the job's done.</p>
            </>
        )
    },

    // ─── W1.10 Run small business from your phone (hub) ───────────────────────
    "run-small-business-from-your-phone": {
        title: "How to Run Your Small Business From Your Phone (2026 Stack)",
        date: "Jun 27, 2026",
        datePublished: "2026-06-27",
        readTime: "7 min read",
        category: "Guide",
        description: "You can run nearly all of your small business admin from your phone in 2026. Here's the practical stack for invoicing, quoting, bookings, payments and follow-ups.",
        content: (
            <>
                <p className="text-xl text-gray-700 leading-relaxed mb-6">
                    Your phone is already where your business happens: the enquiries, the quotes, the supplier chats. The only reason you still open a laptop is admin. In 2026 you don't have to. Here's the practical stack for running nearly everything from your phone.
                </p>

                <Hero pose="phone" />

                <h2>The five jobs to move to your phone</h2>
                <div className="grid md:grid-cols-2 gap-6 my-8">
                    <div className="bg-white border-2 border-black p-6"><MessageSquare className="text-brand-500 mb-3" size={28} /><h3 className="text-xl font-bold mb-2">Replying to leads</h3><p className="text-gray-700">Fast replies win jobs. The first to answer usually books the work. <Link to="/blog/reply-to-leads-faster-speed-to-lead">More on speed to lead</Link>.</p></div>
                    <div className="bg-white border-2 border-black p-6"><Calendar className="text-brand-500 mb-3" size={28} /><h3 className="text-xl font-bold mb-2">Bookings</h3><p className="text-gray-700">Take bookings in the text and have them land in your calendar. <Link to="/blog/how-to-take-bookings-over-text">How to do it</Link>.</p></div>
                    <div className="bg-white border-2 border-black p-6"><FileText className="text-brand-500 mb-3" size={28} /><h3 className="text-xl font-bold mb-2">Quotes & invoices</h3><p className="text-gray-700">Build and send both from your phone in under a minute. <Link to="/blog/send-invoice-from-your-phone">Here's how</Link>.</p></div>
                    <div className="bg-white border-2 border-black p-6"><DollarSign className="text-brand-500 mb-3" size={28} /><h3 className="text-xl font-bold mb-2">Getting paid</h3><p className="text-gray-700">Automatic reminders so you stop chasing. <Link to="/blog/late-payment-reminder-templates">Templates here</Link>.</p></div>
                </div>

                <h2>Two ways to build the stack</h2>
                <p><strong>The app pile.</strong> An accounting app, a scheduling app, a payments app, a notes app. It works, but you're juggling four logins and copying data between them. Most owners use a fraction of each.</p>
                <p className="mt-4"><strong>The one-text approach.</strong> Instead of four apps, one assistant in your messages that handles all of it and files into the tools you already use. The bar to use it is "send a text", which means you actually do.</p>

                <div className="overflow-x-auto my-8">
                    <table className="w-full border-2 border-black">
                        <thead className="bg-black text-white"><tr><th className="p-4 text-left font-display">Job</th><th className="p-4 text-left font-display">App pile</th><th className="p-4 text-left font-display">One text</th></tr></thead>
                        <tbody className="bg-white">
                            <tr className="border-b-2 border-black"><td className="p-4">Invoice a job</td><td className="p-4">Open accounting app</td><td className="p-4">Text it</td></tr>
                            <tr className="border-b-2 border-black"><td className="p-4">Book a client</td><td className="p-4">Open scheduling app</td><td className="p-4">Text it</td></tr>
                            <tr className="border-b-2 border-black"><td className="p-4">Chase a payment</td><td className="p-4">Remember to, manually</td><td className="p-4">Automatic</td></tr>
                            <tr><td className="p-4">Logins to manage</td><td className="p-4">Four or more</td><td className="p-4">One</td></tr>
                        </tbody>
                    </table>
                </div>

                <MessageFlynnCTA
                    headline="Run it all from one text thread"
                    body="Flynn is the one-text stack: invoices, quotes, bookings, payment chasing and lead replies, all from your messages, all filed into the tools you already use."
                    mascot="thumbsup"
                />

                <h2>Where to start</h2>
                <p>Don't move everything at once. Pick the job that wastes the most time, usually invoicing or chasing payments, and move that first. Once it's off your plate, add the next. Before long the laptop is for the rare big job, and the day-to-day runs from your pocket. That's the whole idea behind <Link to="/blog/run-your-business-from-imessage">running your business from iMessage</Link>.</p>
            </>
        )
    },

    // ─── W2.1 Best AI tools for small business (roundup) ──────────────────────
    "best-ai-tools-for-small-business": {
        title: "The Best AI Tools for Small Business in 2026 (Tested by Job)",
        date: "Jun 30, 2026",
        datePublished: "2026-06-30",
        readTime: "9 min read",
        category: "Comparison",
        description: "A practical roundup of the best AI tools for small business in 2026, sorted by the job you actually need done: writing, design, automation, accounting and admin.",
        content: (
            <>
                <p className="text-xl text-gray-700 leading-relaxed mb-6">
                    Most "best AI tools" lists are 30 apps you'll never open. This one is sorted by the job you actually need done, so you can pick one per problem and move on. Here's what's genuinely worth your time in 2026.
                </p>

                <Hero pose="thinking" />

                <h2>Best for writing: ChatGPT or Claude</h2>
                <p>For emails, ad copy, social captions and tricky replies, a general chatbot is hard to beat. It drafts in seconds and rewrites until it sounds right. Just remember it doesn't know your business, so it can't price a job or send anything. See the honest limits in <Link to="/blog/chatgpt-for-small-business">ChatGPT for small business</Link>.</p>

                <h2>Best for design: Canva AI</h2>
                <p>Logos, flyers, social posts and quick edits without a designer. The AI features turn a rough idea into something presentable fast. Perfect for the marketing you keep putting off.</p>

                <h2>Best for connecting apps: Zapier</h2>
                <p>If your tools don't talk to each other, Zapier's AI can wire them together so data flows without copy-paste. Powerful, but it's a builder's tool, you set up the automations yourself.</p>

                <h2>Best for the books: your accounting tool's AI</h2>
                <p>Xero, QuickBooks and MYOB now auto-categorise transactions and flag anomalies. Great for keeping the books tidy, though you still drive the app.</p>

                <h2>Best for the admin that eats your evenings: a business agent</h2>
                <p>This is the category most lists miss. Writing tools suggest, builder tools need setup, accounting tools need driving. A business agent actually does the admin: sends invoices, books jobs, chases payments, replies to leads, from a text, knowing your real numbers. That's the difference between saving five minutes and saving the whole evening.</p>

                <div className="overflow-x-auto my-8">
                    <table className="w-full border-2 border-black text-sm">
                        <thead className="bg-black text-white"><tr><th className="p-3 text-left font-display">Job</th><th className="p-3 text-left font-display">Pick</th><th className="p-3 text-left font-display">Does it act for you?</th></tr></thead>
                        <tbody className="bg-white">
                            <tr className="border-b-2 border-black"><td className="p-3 font-bold">Writing</td><td className="p-3">ChatGPT / Claude</td><td className="p-3"><XCircle className="text-red-500" size={18} /> Drafts only</td></tr>
                            <tr className="border-b-2 border-black"><td className="p-3 font-bold">Design</td><td className="p-3">Canva AI</td><td className="p-3"><XCircle className="text-red-500" size={18} /> You design</td></tr>
                            <tr className="border-b-2 border-black"><td className="p-3 font-bold">Connecting apps</td><td className="p-3">Zapier</td><td className="p-3">You build it</td></tr>
                            <tr className="border-b-2 border-black"><td className="p-3 font-bold">Bookkeeping</td><td className="p-3">Xero / QuickBooks AI</td><td className="p-3">You drive it</td></tr>
                            <tr><td className="p-3 font-bold">Admin (invoices, bookings, chasing)</td><td className="p-3">A business agent</td><td className="p-3"><CheckCircle className="text-green-600" size={18} /> Yes</td></tr>
                        </tbody>
                    </table>
                </div>

                <MessageFlynnCTA
                    headline="The tool that does the admin, not just suggests it"
                    body="Flynn is the business-agent pick: it sends invoices, books jobs and chases payments from a text, using your real prices. Confirms before anything goes out."
                    mascot="thumbsup"
                />

                <h2>How to choose</h2>
                <p>Don't install ten tools. Pick the one job costing you the most time and solve that first. For most owners it's the admin, not the writing. Start there, then layer in the rest. More on the admin side in <Link to="/blog/ai-tools-small-business-admin">AI tools to run your small business admin</Link>.</p>
            </>
        )
    },

    // ─── W2.2 Best appointment scheduling app for small business ──────────────
    "best-appointment-scheduling-app-small-business": {
        title: "The Best Appointment Scheduling App for Small Business (2026)",
        date: "Jul 1, 2026",
        datePublished: "2026-07-01",
        readTime: "7 min read",
        category: "Comparison",
        description: "Comparing the best appointment scheduling apps for small business in 2026: Calendly, Square, Setmore and the text-first option, by who actually books more clients.",
        content: (
            <>
                <p className="text-xl text-gray-700 leading-relaxed mb-6">
                    The best scheduling app isn't the one with the most features, it's the one your clients actually use. Here's an honest comparison for small business in 2026, sorted by how your clients prefer to book.
                </p>

                <Hero pose="phone" />

                <h2>The main options</h2>
                <div className="grid md:grid-cols-2 gap-6 my-8">
                    <div className="bg-white border-2 border-black p-6"><h3 className="text-xl font-bold mb-2">Calendly</h3><p className="text-gray-700">Clean booking links, great for consultations and demos. Free plan is generous. Best when clients are happy to self-serve.</p></div>
                    <div className="bg-white border-2 border-black p-6"><h3 className="text-xl font-bold mb-2">Square Appointments</h3><p className="text-gray-700">Booking plus payments in one, strong for salons and in-person services already using Square.</p></div>
                    <div className="bg-white border-2 border-black p-6"><h3 className="text-xl font-bold mb-2">Setmore / SimplyBook</h3><p className="text-gray-700">Generous free tiers, branded booking pages, good for service businesses wanting an online presence.</p></div>
                    <div className="bg-white border-2 border-black p-6"><h3 className="text-xl font-bold mb-2">Text-first (Flynn)</h3><p className="text-gray-700">No booking page. Clients book in the same text thread they already use. Best for messy, conversational bookings.</p></div>
                </div>

                <h2>The question that decides it</h2>
                <p>How do your clients actually try to book? If they happily click a link and pick a slot, a booking-link app is perfect. If they text "you free this week?" and won't chase a link, you're losing some of them at that step, and booking from the text wins. Most service businesses are a mix, but the messier your inbox, the more the text-first approach pays off.</p>

                <div className="overflow-x-auto my-8">
                    <table className="w-full border-2 border-black text-sm">
                        <thead className="bg-black text-white"><tr><th className="p-3 text-left font-display">If you want...</th><th className="p-3 text-left font-display">Best pick</th></tr></thead>
                        <tbody className="bg-white">
                            <tr className="border-b-2 border-black"><td className="p-3">A self-serve booking page</td><td className="p-3">Calendly or Setmore</td></tr>
                            <tr className="border-b-2 border-black"><td className="p-3">Booking + card payments in person</td><td className="p-3">Square</td></tr>
                            <tr className="border-b-2 border-black"><td className="p-3">To book clients in the text</td><td className="p-3">Flynn</td></tr>
                            <tr><td className="p-3">Bookings plus invoices & chasing</td><td className="p-3">Flynn</td></tr>
                        </tbody>
                    </table>
                </div>

                <MessageFlynnCTA
                    headline="Book clients without a booking page"
                    body="Flynn checks your calendar and books clients right in the text, then handles the invoice and reminders too. No app or link for your client to chase."
                    mascot="phone"
                />

                <p>Go deeper in <Link to="/blog/flynn-vs-calendly-square-booking-by-text">Flynn vs Calendly and Square</Link>, learn <Link to="/blog/how-to-take-bookings-over-text">how to take bookings over text</Link>, and <Link to="/blog/how-to-reduce-no-shows-small-business">cut your no-shows</Link>.</p>
            </>
        )
    },

    // ─── W2.3 How to write a quote ────────────────────────────────────────────
    "how-to-write-a-quote": {
        title: "How to Write a Quote That Wins the Job (Free Template)",
        date: "Jul 2, 2026",
        datePublished: "2026-07-02",
        readTime: "7 min read",
        category: "How-To",
        description: "A clear guide to writing a professional quote that wins more jobs, what to include, how to price it, common mistakes, and a free template you can copy.",
        content: (
            <>
                <p className="text-xl text-gray-700 leading-relaxed mb-6">
                    A good quote does two jobs: it tells the client what they're paying for, and it makes you look like the safe choice. Most quotes only do the first. Here's how to write one that actually wins the work, plus a template to copy.
                </p>

                <Hero pose="write" />

                <h2>What every quote should include</h2>
                <ul>
                    <li><strong>Your business details and ABN</strong> so it looks legitimate.</li>
                    <li><strong>A clear description of the work</strong>, specific enough that there's no confusion later.</li>
                    <li><strong>Itemised pricing</strong>, labour and materials split out where it helps.</li>
                    <li><strong>GST</strong> shown clearly, or a note that the total includes it.</li>
                    <li><strong>What's not included</strong>, the line that prevents most disputes.</li>
                    <li><strong>Validity</strong>, e.g. "valid for 30 days", which also nudges a decision.</li>
                    <li><strong>A clear next step</strong>: "reply yes and I'll book you in".</li>
                </ul>

                <h2>The free template</h2>
                <div className="bg-surface-50 border-2 border-black p-6 my-6 text-sm">
                    <p className="m-0"><strong>[Your business name] — ABN [number]</strong></p>
                    <p className="mt-2 mb-0">Quote for: [client name], [date]</p>
                    <p className="mt-2 mb-0">Work: [clear description]</p>
                    <p className="mt-2 mb-0">Labour: [hours x rate] = $[amount]</p>
                    <p className="mt-1 mb-0">Materials: $[amount]</p>
                    <p className="mt-1 mb-0">GST: $[amount]</p>
                    <p className="mt-1 mb-0"><strong>Total: $[amount] inc GST</strong></p>
                    <p className="mt-2 mb-0">Not included: [exclusions]</p>
                    <p className="mt-1 mb-0">Valid for 30 days. Reply yes and I'll lock in a time.</p>
                </div>

                <h2>How to price it so you win without underselling</h2>
                <p>Don't race to the bottom. Clients rarely pick the cheapest, they pick the one they trust to do it right. A clear, confident quote with a fair price beats a vague cheap one. If you're nervous about a number, itemise it, breaking it down makes the total feel fair instead of scary.</p>

                <h2>The mistakes that lose jobs</h2>
                <div className="grid md:grid-cols-3 gap-6 my-8">
                    <div className="bg-white border-2 border-black p-6 text-center"><Clock className="text-brand-500 mx-auto mb-2" size={28} /><div className="font-bold">Too slow</div><p className="text-sm text-gray-600 mt-2">The fastest quote often wins. Same-day beats perfect-but-late.</p></div>
                    <div className="bg-white border-2 border-black p-6 text-center"><XCircle className="text-brand-500 mx-auto mb-2" size={28} /><div className="font-bold">Too vague</div><p className="text-sm text-gray-600 mt-2">"Bathroom reno, $8k" invites doubt. Detail builds trust.</p></div>
                    <div className="bg-white border-2 border-black p-6 text-center"><MessageSquare className="text-brand-500 mx-auto mb-2" size={28} /><div className="font-bold">No follow-up</div><p className="text-sm text-gray-600 mt-2">Most quotes go quiet. The nudge wins the job.</p></div>
                </div>

                <MessageFlynnCTA
                    headline="Quote in seconds, follow up automatically"
                    body="Tell Flynn the job and it drafts a clean, itemised quote in your business name, then reminds you (or the client) to follow up so it never goes cold."
                    mascot="write"
                />

                <p>Once it's sent, learn <Link to="/blog/how-to-follow-up-on-a-quote">how to follow up without being annoying</Link>, and know the difference between a <Link to="/blog/quote-vs-estimate-vs-invoice">quote, estimate and invoice</Link>.</p>
            </>
        )
    },

    // ─── W2.4 How to reduce no-shows ──────────────────────────────────────────
    "how-to-reduce-no-shows-small-business": {
        title: "How to Reduce No-Shows (Reminder Scripts That Actually Work)",
        date: "Jul 3, 2026",
        datePublished: "2026-07-03",
        readTime: "6 min read",
        category: "How-To",
        description: "No-shows quietly cost small businesses thousands a year. Here's how to reduce them with the right reminders, deposits and booking habits, plus reminder scripts to copy.",
        content: (
            <>
                <p className="text-xl text-gray-700 leading-relaxed mb-6">
                    A no-show isn't just a gap in your day, it's a slot you turned other clients away for. They add up to real money. The good news is most no-shows are preventable with a few simple habits. Here's what works.
                </p>

                <Hero pose="point" />

                <h2>Why people no-show (it's rarely rudeness)</h2>
                <p>Most no-shows are forgetfulness, not disrespect. Someone booked two weeks ago, life got busy, the appointment fell out of their head. Which means the fix isn't being stricter, it's being more memorable: the right reminder at the right time.</p>

                <h2>The reminder rhythm that works</h2>
                <div className="space-y-4 my-8">
                    <div className="bg-white border-2 border-black p-5 flex items-start gap-4"><span className="bg-brand-500 text-white font-bold px-3 py-1 flex-shrink-0">On booking</span><p className="m-0">Instant confirmation. "You're booked for [day] at [time]. See you then!" Writing it down makes it real.</p></div>
                    <div className="bg-white border-2 border-black p-5 flex items-start gap-4"><span className="bg-brand-500 text-white font-bold px-3 py-1 flex-shrink-0">Day before</span><p className="m-0">"Hi [name], reminder you're booked tomorrow at [time]. Reply YES to confirm or let me know if you need to move it."</p></div>
                    <div className="bg-white border-2 border-black p-5 flex items-start gap-4"><span className="bg-brand-500 text-white font-bold px-3 py-1 flex-shrink-0">Few hours before</span><p className="m-0">For same-day services: "See you at [time], [name]. Text me if anything changes."</p></div>
                </div>
                <p>That "reply YES to confirm" line is the workhorse. It turns a passive reminder into a tiny commitment, and it surfaces the cancellations early so you can fill the slot.</p>

                <h2>The other levers</h2>
                <div className="grid md:grid-cols-3 gap-6 my-8">
                    <div className="bg-white border-2 border-black p-6 text-center"><DollarSign className="text-brand-500 mx-auto mb-2" size={28} /><div className="font-bold">Deposits</div><p className="text-sm text-gray-600 mt-2">A small deposit for big jobs makes people show up.</p></div>
                    <div className="bg-white border-2 border-black p-6 text-center"><CheckCircle className="text-brand-500 mx-auto mb-2" size={28} /><div className="font-bold">Easy rescheduling</div><p className="text-sm text-gray-600 mt-2">If moving a booking is easy, people move it instead of ghosting.</p></div>
                    <div className="bg-white border-2 border-black p-6 text-center"><Clock className="text-brand-500 mx-auto mb-2" size={28} /><div className="font-bold">Short lead times</div><p className="text-sm text-gray-600 mt-2">The further out a booking, the more likely it's forgotten.</p></div>
                </div>

                <MessageFlynnCTA
                    headline="Reminders that send themselves"
                    body="Flynn confirms every booking and sends the day-before reminder for you, in your voice. Fewer no-shows, no manual texting, slots filled when someone cancels early."
                    mascot="point"
                />

                <p>Pair this with <Link to="/blog/how-to-take-bookings-over-text">taking bookings over text</Link> and grab the wording from our <Link to="/blog/customer-follow-up-text-templates">follow-up templates</Link>.</p>
            </>
        )
    },

    // ─── W2.5 Small business tax deductions (AU) ──────────────────────────────
    "small-business-tax-deductions-australia": {
        title: "Small Business Tax Deductions Checklist (Australia, 2026)",
        date: "Jul 4, 2026",
        datePublished: "2026-07-04",
        readTime: "8 min read",
        category: "Guide",
        description: "A plain-English checklist of common small business tax deductions in Australia for 2026, from vehicle and tools to home office, so you don't leave money on the table.",
        content: (
            <>
                <p className="text-xl text-gray-700 leading-relaxed mb-6">
                    Every dollar of legitimate business expense you claim is a dollar you're not taxed on. Plenty of small businesses miss claims simply because they didn't track them. Here's a plain-English checklist of common deductions so nothing slips through.
                </p>

                <Hero pose="thinking" />

                <p className="text-sm text-gray-500 italic">This is general information, not tax advice. Check your situation with your accountant or the ATO.</p>

                <h2>The big categories</h2>
                <div className="grid md:grid-cols-2 gap-6 my-8">
                    <div className="bg-white border-2 border-black p-6"><h3 className="text-lg font-bold mb-2">Vehicle & travel</h3><p className="text-gray-700 text-sm">Work-related km, fuel, servicing, registration, parking and tolls. Keep a logbook.</p></div>
                    <div className="bg-white border-2 border-black p-6"><h3 className="text-lg font-bold mb-2">Tools & equipment</h3><p className="text-gray-700 text-sm">Tools, machinery, devices. Smaller items outright, bigger ones depreciated.</p></div>
                    <div className="bg-white border-2 border-black p-6"><h3 className="text-lg font-bold mb-2">Home office</h3><p className="text-gray-700 text-sm">A portion of power, internet and a dedicated work area if you run things from home.</p></div>
                    <div className="bg-white border-2 border-black p-6"><h3 className="text-lg font-bold mb-2">Phone & internet</h3><p className="text-gray-700 text-sm">The work-use portion of your phone and data plans.</p></div>
                    <div className="bg-white border-2 border-black p-6"><h3 className="text-lg font-bold mb-2">Software & subscriptions</h3><p className="text-gray-700 text-sm">Accounting tools, scheduling apps, cloud storage, industry memberships.</p></div>
                    <div className="bg-white border-2 border-black p-6"><h3 className="text-lg font-bold mb-2">Insurance & fees</h3><p className="text-gray-700 text-sm">Public liability, tool insurance, bank fees, merchant fees.</p></div>
                    <div className="bg-white border-2 border-black p-6"><h3 className="text-lg font-bold mb-2">Marketing</h3><p className="text-gray-700 text-sm">Ads, website, signage, printing, business cards.</p></div>
                    <div className="bg-white border-2 border-black p-6"><h3 className="text-lg font-bold mb-2">Education & super</h3><p className="text-gray-700 text-sm">Courses that relate to your work, and your own super contributions.</p></div>
                </div>

                <h2>The claims people forget</h2>
                <ul>
                    <li>Work clothing and protective gear (PPE, branded uniforms).</li>
                    <li>The work-use share of a personal device or vehicle.</li>
                    <li>Bank and payment processing fees, which add up over a year.</li>
                    <li>Accounting and bookkeeping fees themselves.</li>
                    <li>Small subscriptions you forgot you pay for.</li>
                </ul>

                <h2>Why most people under-claim</h2>
                <p>It's not the rules, it's the records. The receipt for a $40 tool in March is long gone by tax time. The fix is logging expenses as they happen, not reconstructing the year in a panic in July. A photo of the receipt, logged the moment you buy, means every claim is there when you need it.</p>

                <MessageFlynnCTA
                    headline="Log every receipt the moment you spend"
                    body="Snap a receipt and text it to Flynn. It logs the expense with date, amount and GST and files it to Xero, so nothing's missing come tax time."
                    mascot="thumbsup"
                />

                <p>Keep the records straight with <Link to="/blog/how-to-track-business-expenses">how to track business expenses without a bookkeeper</Link>, and get the basics in <Link to="/blog/gst-bas-basics-sole-traders">GST and BAS for sole traders</Link>.</p>
            </>
        )
    },

    // ─── W2.6 How to track business expenses ──────────────────────────────────
    "how-to-track-business-expenses": {
        title: "How to Track Business Expenses Without a Bookkeeper",
        date: "Jul 7, 2026",
        datePublished: "2026-07-07",
        readTime: "6 min read",
        category: "How-To",
        description: "A simple system for tracking business expenses without hiring a bookkeeper, so your books stay tidy, your claims are complete, and tax time stops being a nightmare.",
        content: (
            <>
                <p className="text-xl text-gray-700 leading-relaxed mb-6">
                    You don't need a bookkeeper to keep clean records, you need a system you'll actually stick to. The reason expense tracking fails isn't laziness, it's that most systems take effort at the wrong moment. Here's one that doesn't.
                </p>

                <Hero pose="write" />

                <h2>The one rule that fixes everything</h2>
                <p>Capture the expense the second it happens, not later. The receipt you log at the counter is logged. The one you shove in the glovebox to "deal with later" is gone. Everything else is detail. Get this one habit right and your books stay 90% clean on their own.</p>

                <h2>The three-tier setup</h2>
                <div className="space-y-4 my-8">
                    <div className="bg-white border-2 border-black p-5"><h3 className="font-bold mb-1">1. Separate business account</h3><p className="m-0 text-sm text-gray-700">Run business spending through one account or card. Instantly separates business from personal, no untangling later.</p></div>
                    <div className="bg-white border-2 border-black p-5"><h3 className="font-bold mb-1">2. Capture receipts instantly</h3><p className="m-0 text-sm text-gray-700">Snap a photo at the moment of purchase. Paper fades and gets lost; a photo doesn't.</p></div>
                    <div className="bg-white border-2 border-black p-5"><h3 className="font-bold mb-1">3. Log to one place</h3><p className="m-0 text-sm text-gray-700">A spreadsheet or your accounting tool, with vendor, date, amount, GST and category. One source of truth.</p></div>
                </div>

                <h2>Spreadsheet vs accounting app vs just texting it</h2>
                <div className="overflow-x-auto my-8">
                    <table className="w-full border-2 border-black text-sm">
                        <thead className="bg-black text-white"><tr><th className="p-3 text-left font-display">Method</th><th className="p-3 text-left font-display">Effort per expense</th><th className="p-3 text-left font-display">Best for</th></tr></thead>
                        <tbody className="bg-white">
                            <tr className="border-b-2 border-black"><td className="p-3 font-bold">Spreadsheet</td><td className="p-3">Manual entry</td><td className="p-3">Very small / starting out</td></tr>
                            <tr className="border-b-2 border-black"><td className="p-3 font-bold">Accounting app</td><td className="p-3">Open app, snap, categorise</td><td className="p-3">Established businesses</td></tr>
                            <tr><td className="p-3 font-bold">Text a photo</td><td className="p-3">Send one message</td><td className="p-3">Anyone who hates admin</td></tr>
                        </tbody>
                    </table>
                </div>

                <MessageFlynnCTA
                    headline="Tracking expenses as easy as a text"
                    body="Snap the receipt, text it to Flynn. It reads the vendor, amount and GST, logs it and files it to your accounting tool. No app, no spreadsheet, no shoebox."
                    mascot="thumbsup"
                />

                <h2>Why this saves you more than time</h2>
                <p>Clean records mean you claim every deduction you're owed (see the <Link to="/blog/small-business-tax-deductions-australia">deductions checklist</Link>), your <Link to="/blog/gst-bas-basics-sole-traders">BAS</Link> takes minutes not days, and you actually know if you're making money month to month. The habit is small. The payoff is real.</p>
            </>
        )
    },

    // ─── W2.7 What to do when a client won't pay ──────────────────────────────
    "what-to-do-when-a-client-wont-pay": {
        title: "What to Do When a Client Won't Pay (Australia)",
        date: "Jul 8, 2026",
        datePublished: "2026-07-08",
        readTime: "7 min read",
        category: "Guide",
        description: "A calm, step-by-step plan for when a client won't pay your invoice in Australia, from reminders to formal demand to your options for recovering the debt.",
        content: (
            <>
                <p className="text-xl text-gray-700 leading-relaxed mb-6">
                    A client who won't pay is stressful and, sometimes, expensive. But there's a clear path from polite nudge to last resort, and most cases get resolved long before the serious steps. Here's the calm, ordered plan.
                </p>

                <Hero pose="point" />

                <p className="text-sm text-gray-500 italic">General information, not legal advice. For larger debts, consider speaking to a solicitor or your state's small business commissioner.</p>

                <h2>Step 1: Rule out a simple miss</h2>
                <p>Most late payments are oversight, not refusal. A friendly reminder with the invoice and a payment link resolves the majority. Send it before you assume the worst. Use the wording in our <Link to="/blog/late-payment-reminder-templates">late payment reminder templates</Link>.</p>

                <h2>Step 2: Make contact and confirm</h2>
                <p>If reminders go unanswered, call or text directly. Confirm they received the invoice, ask if there's an issue, and get a clear commitment: when will it be paid? Sometimes there's a genuine cash-flow problem and a short payment plan solves it for both of you.</p>

                <h2>Step 3: A formal reminder in writing</h2>
                <p>Put it in writing: the invoice number, amount, original due date, and a firm but professional request for payment by a specific date. Keep the tone businesslike. This becomes useful evidence if things escalate.</p>

                <h2>Step 4: A letter of demand</h2>
                <p>A letter of demand is a formal final notice stating you'll pursue recovery if it isn't paid by a set date. It often works on its own because it signals you're serious. You can write one yourself or have a solicitor send it.</p>

                <h2>Step 5: Your recovery options</h2>
                <div className="overflow-x-auto my-8">
                    <table className="w-full border-2 border-black text-sm">
                        <thead className="bg-black text-white"><tr><th className="p-3 text-left font-display">Option</th><th className="p-3 text-left font-display">Best when</th></tr></thead>
                        <tbody className="bg-white">
                            <tr className="border-b-2 border-black"><td className="p-3 font-bold">Small business commissioner</td><td className="p-3">You want free help to mediate</td></tr>
                            <tr className="border-b-2 border-black"><td className="p-3 font-bold">Debt collection agency</td><td className="p-3">You'd rather outsource the chase</td></tr>
                            <tr className="border-b-2 border-black"><td className="p-3 font-bold">Small claims tribunal</td><td className="p-3">Smaller amounts, low cost, no lawyer needed</td></tr>
                            <tr><td className="p-3 font-bold">Solicitor</td><td className="p-3">Larger debts worth the legal cost</td></tr>
                        </tbody>
                    </table>
                </div>

                <h2>The best fix is prevention</h2>
                <p>Clear payment terms up front, deposits on big jobs, same-day invoicing, and consistent automatic reminders prevent most of this from ever reaching step three. The businesses that rarely get burned aren't tougher, they're just systematic about getting paid.</p>

                <MessageFlynnCTA
                    headline="Make slow payment rare"
                    body="Flynn invoices the moment a job's done and chases overdue payments automatically, politely, on schedule. Most clients pay long before it ever gets awkward."
                    mascot="thumbsup"
                />

                <p>Set it up right with <Link to="/blog/chase-unpaid-invoices-without-awkward-calls">automatic invoice chasing</Link> and <Link to="/blog/send-invoice-from-your-phone">same-day invoicing from your phone</Link>.</p>
            </>
        )
    },

    // ─── W2.8 Quote vs estimate vs invoice ────────────────────────────────────
    "quote-vs-estimate-vs-invoice": {
        title: "Quote vs Estimate vs Invoice: What's the Difference?",
        date: "Jul 9, 2026",
        datePublished: "2026-07-09",
        readTime: "5 min read",
        category: "Guide",
        description: "Quote, estimate and invoice get mixed up all the time, and the difference matters legally and for getting paid. Here's a plain-English explainer for small business.",
        content: (
            <>
                <p className="text-xl text-gray-700 leading-relaxed mb-6">
                    Quote, estimate and invoice sound interchangeable, but they're three different documents with three different jobs, and mixing them up can cost you money or land you in a dispute. Here's the plain-English difference.
                </p>

                <Hero pose="thinking" />

                <h2>The quick version</h2>
                <div className="overflow-x-auto my-8">
                    <table className="w-full border-2 border-black">
                        <thead className="bg-black text-white"><tr><th className="p-4 text-left font-display">Document</th><th className="p-4 text-left font-display">What it is</th><th className="p-4 text-left font-display">Binding?</th></tr></thead>
                        <tbody className="bg-white">
                            <tr className="border-b-2 border-black"><td className="p-4 font-bold">Estimate</td><td className="p-4">A rough, good-faith ballpark of likely cost</td><td className="p-4">No</td></tr>
                            <tr className="border-b-2 border-black"><td className="p-4 font-bold">Quote</td><td className="p-4">A fixed price for clearly defined work</td><td className="p-4">Usually yes, once accepted</td></tr>
                            <tr><td className="p-4 font-bold">Invoice</td><td className="p-4">A request for payment for work done</td><td className="p-4">Yes, it's a debt</td></tr>
                        </tbody>
                    </table>
                </div>

                <h2>Estimate</h2>
                <p>An estimate is your best guess before the details are nailed down. "Probably around $2,000 to $2,500, depending on what we find." It's useful early, but it isn't a promise. The risk is when clients treat an estimate as a fixed quote, so always label it clearly and explain it can change.</p>

                <h2>Quote</h2>
                <p>A quote is a firm price for a defined scope. Once the client accepts it, you're generally bound to that price for that work, which is why specifying what's included (and not) matters so much. A good quote protects both sides. Learn to write a strong one in <Link to="/blog/how-to-write-a-quote">how to write a quote that wins the job</Link>.</p>

                <h2>Invoice</h2>
                <p>An invoice comes after the work (or at agreed milestones) and is a formal request for payment. In Australia a tax invoice over $82.50 inc GST has required fields: your ABN, the words "tax invoice", the date, a description, and the GST amount. An unpaid invoice is a debt you can pursue.</p>

                <h2>How they flow together</h2>
                <p>The clean path is estimate (maybe), then quote, then on acceptance the job, then invoice. Done by hand you retype the same details three times. Done well, the quote rolls straight into the invoice with nothing re-entered.</p>

                <MessageFlynnCTA
                    headline="Quote and invoice without the double-entry"
                    body="Flynn drafts quotes and invoices from a text, in your business name with GST handled, and rolls an accepted quote straight into an invoice. No retyping."
                    mascot="write"
                />

                <p>Next: <Link to="/blog/how-to-write-a-quote">write a winning quote</Link>, then <Link to="/blog/send-invoice-from-your-phone">send the invoice from your phone</Link>.</p>
            </>
        )
    },

    // ─── W2.9 GST & BAS basics for sole traders ───────────────────────────────
    "gst-bas-basics-sole-traders": {
        title: "GST & BAS Basics for Sole Traders (Australia, 2026)",
        date: "Jul 10, 2026",
        datePublished: "2026-07-10",
        readTime: "7 min read",
        category: "Guide",
        description: "A plain-English guide to GST and BAS for Australian sole traders: when to register, how GST works, what a BAS is, and how to make lodging it painless.",
        content: (
            <>
                <p className="text-xl text-gray-700 leading-relaxed mb-6">
                    GST and BAS sound more complicated than they are. For most sole traders it comes down to a few simple rules. Here's the plain-English version so you know what you have to do and when.
                </p>

                <Hero pose="thinking" />

                <p className="text-sm text-gray-500 italic">General information, not tax advice. Check your situation with your accountant or the ATO.</p>

                <h2>When do you have to register for GST?</h2>
                <p>In Australia you must register for GST once your business turnover hits $75,000 a year (or you expect it to). Under that, registering is optional. Some sole traders register early so they can claim GST credits on purchases; others wait until they have to. If you drive for a rideshare or taxi service, you must register regardless of turnover.</p>

                <h2>How GST actually works</h2>
                <p>If you're registered, you add 10% GST to what you charge, collect it from customers, and pass it to the ATO. In return, you can claim back the GST you paid on business purchases. You're essentially a collector in the middle. The difference between GST collected and GST paid is what you owe (or get refunded).</p>

                <div className="bg-surface-50 border-2 border-black p-6 my-6">
                    <p className="m-0"><strong>Simple example:</strong> you charge $1,100 (that's $1,000 + $100 GST). You spent $220 on materials ($200 + $20 GST). You owe the ATO $100 minus $20 = $80.</p>
                </div>

                <h2>What is a BAS?</h2>
                <p>A Business Activity Statement is the form where you report and pay that GST, usually quarterly. It tells the ATO how much GST you collected and paid, and sometimes other things like PAYG instalments. If your record-keeping is tidy, a BAS takes minutes. If it isn't, it's a weekend of pain.</p>

                <div className="overflow-x-auto my-8">
                    <table className="w-full border-2 border-black text-sm">
                        <thead className="bg-black text-white"><tr><th className="p-3 text-left font-display">Quarter</th><th className="p-3 text-left font-display">Period</th><th className="p-3 text-left font-display">Usually due</th></tr></thead>
                        <tbody className="bg-white">
                            <tr className="border-b-2 border-black"><td className="p-3">Q1</td><td className="p-3">Jul to Sep</td><td className="p-3">28 Oct</td></tr>
                            <tr className="border-b-2 border-black"><td className="p-3">Q2</td><td className="p-3">Oct to Dec</td><td className="p-3">28 Feb</td></tr>
                            <tr className="border-b-2 border-black"><td className="p-3">Q3</td><td className="p-3">Jan to Mar</td><td className="p-3">28 Apr</td></tr>
                            <tr><td className="p-3">Q4</td><td className="p-3">Apr to Jun</td><td className="p-3">28 Jul</td></tr>
                        </tbody>
                    </table>
                </div>

                <h2>The thing that makes BAS easy</h2>
                <p>It's all in the records. If every sale and expense is logged with its GST as it happens, your BAS is basically a summary that already exists. If you're reconstructing months of receipts the night before, it's miserable. The fix is the same habit that helps everything else: capture as you go.</p>

                <MessageFlynnCTA
                    headline="Keep GST records without thinking about it"
                    body="Flynn logs your invoices and expenses with GST as they happen and files them to Xero, so when BAS time comes the numbers are already there."
                    mascot="thumbsup"
                />

                <p>Build the habit with <Link to="/blog/how-to-track-business-expenses">how to track business expenses</Link>, and don't miss claims in the <Link to="/blog/small-business-tax-deductions-australia">deductions checklist</Link>.</p>
            </>
        )
    },

    // ─── W2.10 How to get more Google reviews ─────────────────────────────────
    "how-to-get-more-google-reviews": {
        title: "How to Get More Google Reviews for Your Small Business",
        date: "Jul 11, 2026",
        datePublished: "2026-07-11",
        readTime: "6 min read",
        category: "How-To",
        description: "More Google reviews mean more customers. Here's a simple system to get them: when to ask, exactly what to say, and the text templates that actually get reviews written.",
        content: (
            <>
                <p className="text-xl text-gray-700 leading-relaxed mb-6">
                    Google reviews are the closest thing to free marketing there is. More reviews mean you rank higher locally and win more of the customers comparing you to the next business. The catch: happy customers rarely leave one unless you ask. Here's how to ask so they actually do.
                </p>

                <Hero pose="thumbsup" />

                <h2>Timing is everything</h2>
                <p>Ask right after the moment they're happiest: the job finished well, the problem solved, the "thank you so much" text. Wait a week and the warm glow is gone. The best review request goes out within hours of a great result.</p>

                <h2>Make it one tap</h2>
                <p>Every extra step loses people. Don't say "search for us on Google". Send a direct link straight to your review form. The easier it is, the more reviews you get. You can get your review link from your Google Business Profile.</p>

                <h2>The templates that work</h2>
                <div className="bg-surface-50 border-2 border-black p-6 my-6">
                    <p className="m-0"><strong>After a great job:</strong> "So glad you're happy with it, [name]! If you've got 20 seconds, a quick Google review really helps a small business like mine. Here's the link: [link]. No worries at all if not."</p>
                </div>
                <div className="bg-surface-50 border-2 border-black p-6 my-6">
                    <p className="m-0"><strong>Gentle follow-up:</strong> "Hey [name], no pressure, just popping the review link here again in case you had a sec: [link]. Really appreciate it either way."</p>
                </div>

                <h2>The rules</h2>
                <div className="grid md:grid-cols-3 gap-6 my-8">
                    <div className="bg-white border-2 border-black p-6 text-center"><Clock className="text-brand-500 mx-auto mb-2" size={28} /><div className="font-bold">Ask fast</div><p className="text-sm text-gray-600 mt-2">Within hours of a happy result, not days.</p></div>
                    <div className="bg-white border-2 border-black p-6 text-center"><MessageSquare className="text-brand-500 mx-auto mb-2" size={28} /><div className="font-bold">Ask by text</div><p className="text-sm text-gray-600 mt-2">Texts get read and tapped. Emails get buried.</p></div>
                    <div className="bg-white border-2 border-black p-6 text-center"><CheckCircle className="text-brand-500 mx-auto mb-2" size={28} /><div className="font-bold">Ask everyone</div><p className="text-sm text-gray-600 mt-2">Consistency is what builds a wall of reviews.</p></div>
                </div>
                <p>One note: don't offer payment or discounts for reviews, and never write fake ones. Google penalises it and customers can smell it. Just ask, genuinely, every time.</p>

                <MessageFlynnCTA
                    headline="Ask for reviews automatically"
                    body="Flynn can send a review request with your link right after a job wraps, in your voice, to every happy customer. More reviews, zero remembering."
                    mascot="thumbsup"
                />

                <p>It's the same habit as good <Link to="/blog/customer-follow-up-text-templates">customer follow-ups</Link>, and it compounds with replying fast to the new leads those reviews bring in (<Link to="/blog/reply-to-leads-faster-speed-to-lead">speed to lead</Link>).</p>
            </>
        )
    },

    // ─── W3.1 Cleaning businesses: admin ──────────────────────────────────────
    "admin-tips-for-cleaning-businesses": {
        title: "How Cleaning Businesses Can Cut Admin Time in Half",
        date: "Jul 14, 2026",
        datePublished: "2026-07-14",
        readTime: "6 min read",
        category: "Guide",
        description: "Cleaning businesses lose hours every week to quotes, recurring bookings and chasing payment. Here's how to cut that admin in half and spend more time on the tools.",
        content: (
            <>
                <p className="text-xl text-gray-700 leading-relaxed mb-6">
                    Running a cleaning business is mostly logistics: quoting one-off deep cleans, juggling recurring weekly and fortnightly bookings, and chasing payment after the job. The cleaning is the easy part. Here's how to take the admin off your plate.
                </p>

                <Hero pose="write" />

                <h2>Where the time actually goes</h2>
                <div className="grid md:grid-cols-3 gap-6 my-8">
                    <div className="bg-white border-2 border-black p-6 text-center"><FileText className="text-brand-500 mx-auto mb-2" size={28} /><div className="font-bold">Quoting</div><p className="text-sm text-gray-600 mt-2">Every enquiry wants a price for a different sized place.</p></div>
                    <div className="bg-white border-2 border-black p-6 text-center"><Calendar className="text-brand-500 mx-auto mb-2" size={28} /><div className="font-bold">Recurring bookings</div><p className="text-sm text-gray-600 mt-2">Weekly, fortnightly, monthly, all needing reminders.</p></div>
                    <div className="bg-white border-2 border-black p-6 text-center"><DollarSign className="text-brand-500 mx-auto mb-2" size={28} /><div className="font-bold">Getting paid</div><p className="text-sm text-gray-600 mt-2">Invoicing after each clean and chasing the slow ones.</p></div>
                </div>

                <h2>The fixes that matter most</h2>
                <p><strong>Quote fast.</strong> Cleaning leads compare three or four quotes and book the first decent reply. Same-day quoting wins more work. See <Link to="/blog/how-to-write-a-quote">how to write a quote that wins</Link>.</p>
                <p className="mt-4"><strong>Lock in the recurring clients.</strong> Confirmations and day-before reminders cut no-shows on regular jobs and keep the schedule full. More in <Link to="/blog/how-to-reduce-no-shows-small-business">reducing no-shows</Link>.</p>
                <p className="mt-4"><strong>Invoice the moment you leave.</strong> The invoice sent from the driveway gets paid days sooner. Automate the chase so you never do it by hand.</p>

                <MessageFlynnCTA
                    headline="Let Flynn run the cleaning admin"
                    body="Quote new jobs, manage recurring bookings, invoice after each clean and chase late payers, all from a text. Flynn learns your rates so it never asks twice."
                    mascot="thumbsup"
                />

                <p>See the tools in <Link to="/blog/best-apps-for-cleaning-businesses">best apps for cleaning businesses</Link>, or run it all from your phone with <Link to="/blog/run-small-business-from-your-phone">the 2026 stack</Link>.</p>
            </>
        )
    },

    // ─── W3.2 Cleaning businesses: best apps ──────────────────────────────────
    "best-apps-for-cleaning-businesses": {
        title: "Best Apps for Cleaning Businesses in 2026",
        date: "Jul 15, 2026",
        datePublished: "2026-07-15",
        readTime: "6 min read",
        category: "Comparison",
        description: "The best apps for cleaning businesses in 2026 for scheduling, quoting, invoicing and getting paid, plus the text-first option for cleaners who hate admin.",
        content: (
            <>
                <p className="text-xl text-gray-700 leading-relaxed mb-6">
                    The right app for a cleaning business depends on your size. A solo cleaner needs something different to a 10-van operation. Here's an honest sort of the options in 2026.
                </p>

                <Hero pose="point" />

                <h2>The main categories</h2>
                <div className="overflow-x-auto my-8">
                    <table className="w-full border-2 border-black text-sm">
                        <thead className="bg-black text-white"><tr><th className="p-3 text-left font-display">Tool</th><th className="p-3 text-left font-display">Good for</th></tr></thead>
                        <tbody className="bg-white">
                            <tr className="border-b-2 border-black"><td className="p-3 font-bold">ZenMaid / Launch27</td><td className="p-3">Cleaning-specific scheduling for teams</td></tr>
                            <tr className="border-b-2 border-black"><td className="p-3 font-bold">Jobber / ServiceM8</td><td className="p-3">Full job management for bigger crews</td></tr>
                            <tr className="border-b-2 border-black"><td className="p-3 font-bold">Xero / QuickBooks</td><td className="p-3">The accounting underneath it all</td></tr>
                            <tr><td className="p-3 font-bold">Flynn (text-first)</td><td className="p-3">Solo & small teams who want admin handled by text</td></tr>
                        </tbody>
                    </table>
                </div>

                <h2>How to choose</h2>
                <p>Run a big team with dispatching and staff tracking? A full platform like Jobber earns its keep. Solo or a small crew who just wants the quoting, booking and chasing to disappear? A dedicated platform is overkill and you'll fight the setup. That's where a text assistant wins: the bar to use it is "send a text", and it files into the accounting tool you already use.</p>

                <MessageFlynnCTA
                    headline="The no-app option for cleaners"
                    body="Flynn quotes, books, invoices and chases payment from a text, and files into Xero. No new platform to learn between jobs."
                    mascot="thumbsup"
                />

                <p>More on the workflow in <Link to="/blog/admin-tips-for-cleaning-businesses">how cleaning businesses can cut admin time</Link>, and the bigger comparison in <Link to="/blog/flynn-vs-tradify-jobber-servicem8">Flynn vs Tradify, Jobber and ServiceM8</Link>.</p>
            </>
        )
    },

    // ─── W3.3 Salons & barbers: admin ─────────────────────────────────────────
    "admin-tips-for-salons-and-barbers": {
        title: "How Salons and Barbers Can Cut Admin and No-Shows",
        date: "Jul 16, 2026",
        datePublished: "2026-07-16",
        readTime: "6 min read",
        category: "Guide",
        description: "No-shows and the booking back-and-forth quietly cost salons and barbers thousands. Here's how to cut both, keep the chair full and spend less time on the phone.",
        content: (
            <>
                <p className="text-xl text-gray-700 leading-relaxed mb-6">
                    For a salon or barber, every empty chair is lost money you can't get back. Between no-shows, the endless booking back-and-forth, and rebooking regulars, the admin adds up fast. Here's how to tighten it up.
                </p>

                <Hero pose="phone" />

                <h2>The no-show problem</h2>
                <p>No-shows are the biggest silent cost in the chair. Most are forgetfulness, not rudeness, which means reminders fix the majority. A confirmation on booking and a day-before "reply YES to confirm" text dramatically cuts the empty slots, and surfaces cancellations early so you can fill them. Full playbook in <Link to="/blog/how-to-reduce-no-shows-small-business">how to reduce no-shows</Link>.</p>

                <h2>The booking back-and-forth</h2>
                <p>Clients text "any chance friday?" and you're mid-cut. By the time you reply they've booked elsewhere. Booking straight from the text, with real available times, captures those clients instead of losing them. See <Link to="/blog/how-to-take-bookings-over-text">how to take bookings over text</Link>.</p>

                <h2>Rebooking regulars</h2>
                <p>Your best clients come back on a rhythm. A simple "it's been about 5 weeks, want me to book your usual?" keeps the chair full and saves them thinking about it. Done consistently, rebooking is the cheapest growth there is.</p>

                <MessageFlynnCTA
                    headline="Keep the chair full, hands-free"
                    body="Flynn books clients from the text, confirms and reminds them to cut no-shows, and nudges regulars to rebook, all in your voice. You stay on the tools."
                    mascot="phone"
                />

                <p>Compare booking tools in <Link to="/blog/best-apps-for-hair-salons">best apps for salons and barbers</Link>.</p>
            </>
        )
    },

    // ─── W3.4 Salons & barbers: best apps ─────────────────────────────────────
    "best-apps-for-hair-salons": {
        title: "Best Apps for Hair Salons and Barbers (2026)",
        date: "Jul 17, 2026",
        datePublished: "2026-07-17",
        readTime: "6 min read",
        category: "Comparison",
        description: "The best booking and admin apps for hair salons and barbers in 2026: Fresha, Square, Booksy and the text-first option, sorted by what fits your shop.",
        content: (
            <>
                <p className="text-xl text-gray-700 leading-relaxed mb-6">
                    Salon software is a crowded space. Here's an honest sort of the main options in 2026, by the kind of shop you run.
                </p>

                <Hero pose="point" />

                <div className="overflow-x-auto my-8">
                    <table className="w-full border-2 border-black text-sm">
                        <thead className="bg-black text-white"><tr><th className="p-3 text-left font-display">Tool</th><th className="p-3 text-left font-display">Good for</th></tr></thead>
                        <tbody className="bg-white">
                            <tr className="border-b-2 border-black"><td className="p-3 font-bold">Fresha</td><td className="p-3">Free booking + payments, big salon feature set</td></tr>
                            <tr className="border-b-2 border-black"><td className="p-3 font-bold">Square Appointments</td><td className="p-3">Booking plus in-person card payments</td></tr>
                            <tr className="border-b-2 border-black"><td className="p-3 font-bold">Booksy</td><td className="p-3">Marketplace exposure for new clients</td></tr>
                            <tr><td className="p-3 font-bold">Flynn (text-first)</td><td className="p-3">Booking from the text + reminders + rebooking, no app for clients</td></tr>
                        </tbody>
                    </table>
                </div>

                <h2>How to choose</h2>
                <p>Want a public booking page and a marketplace to find new clients? Fresha or Booksy do that well. Most of your bookings come by text from existing clients, and you mainly need fewer no-shows and easy rebooking? Booking from the text fits how your clients already behave, and there's no app for them to download.</p>

                <MessageFlynnCTA
                    headline="Booking and reminders from the text"
                    body="Flynn books clients in the conversation, sends confirmations and reminders to cut no-shows, and nudges regulars to rebook. No booking app for your clients."
                    mascot="phone"
                />

                <p>More in <Link to="/blog/admin-tips-for-salons-and-barbers">how salons cut admin and no-shows</Link> and <Link to="/blog/flynn-vs-calendly-square-booking-by-text">Flynn vs Calendly and Square</Link>.</p>
            </>
        )
    },

    // ─── W3.5 Real estate agents: admin ───────────────────────────────────────
    "admin-tips-for-real-estate-agents": {
        title: "How Real Estate Agents Can Win More Leads With Less Admin",
        date: "Jul 18, 2026",
        datePublished: "2026-07-18",
        readTime: "6 min read",
        category: "Guide",
        description: "In real estate the fastest reply wins the lead. Here's how agents can respond instantly, book inspections, and follow up buyers and vendors without drowning in admin.",
        content: (
            <>
                <p className="text-xl text-gray-700 leading-relaxed mb-6">
                    Real estate runs on speed and follow-up. The agent who replies first usually gets the appraisal, and the one who follows up consistently wins the listing. The problem is doing that while you're at an open or in the car. Here's how.
                </p>

                <Hero pose="phone" />

                <h2>Speed wins the lead</h2>
                <p>Property enquiries go cold in minutes. A buyer messaging about a listing is messaging three agents. The first useful reply usually gets the inspection. Replying instantly, even while you're showing a property, is the single biggest lever. See <Link to="/blog/reply-to-leads-faster-speed-to-lead">why speed to lead wins</Link>.</p>

                <h2>Booking inspections without the tag</h2>
                <p>Coordinating inspection times by phone tag burns hours. Offering real times in the text and booking on the spot keeps buyers moving and your calendar full. More in <Link to="/blog/how-to-take-bookings-over-text">taking bookings over text</Link>.</p>

                <h2>Follow-up is the whole job</h2>
                <p>Most deals are won in the follow-up: the buyer who needed two weeks, the vendor still deciding. Consistent, personal follow-up is what separates top agents, and it's exactly the thing that slips when you're busy. Templates in <Link to="/blog/customer-follow-up-text-templates">customer follow-up texts</Link>.</p>

                <MessageFlynnCTA
                    headline="Reply first, follow up always"
                    body="Flynn replies to enquiries instantly in your voice, books inspections from the text, and keeps buyers and vendors followed up, while you're out showing properties."
                    mascot="phone"
                />

                <p>See the tools in <Link to="/blog/best-apps-for-real-estate-agents">best apps for real estate agents</Link>.</p>
            </>
        )
    },

    // ─── W3.6 Real estate agents: best apps ───────────────────────────────────
    "best-apps-for-real-estate-agents": {
        title: "Best Apps for Real Estate Agents in 2026",
        date: "Jul 21, 2026",
        datePublished: "2026-07-21",
        readTime: "6 min read",
        category: "Comparison",
        description: "The best apps for real estate agents in 2026 for lead response, scheduling and follow-up, plus the text-first assistant that handles enquiries while you're at an open.",
        content: (
            <>
                <p className="text-xl text-gray-700 leading-relaxed mb-6">
                    Agents drown in tools: a CRM, a scheduler, a dialer, a follow-up app. Here's what actually matters in 2026 and how to keep it simple.
                </p>

                <Hero pose="point" />

                <div className="overflow-x-auto my-8">
                    <table className="w-full border-2 border-black text-sm">
                        <thead className="bg-black text-white"><tr><th className="p-3 text-left font-display">Tool</th><th className="p-3 text-left font-display">Good for</th></tr></thead>
                        <tbody className="bg-white">
                            <tr className="border-b-2 border-black"><td className="p-3 font-bold">A real estate CRM</td><td className="p-3">Pipeline and contact management at scale</td></tr>
                            <tr className="border-b-2 border-black"><td className="p-3 font-bold">Calendly</td><td className="p-3">Self-serve inspection / appraisal booking</td></tr>
                            <tr className="border-b-2 border-black"><td className="p-3 font-bold">Your phone + texts</td><td className="p-3">Where buyers and vendors actually talk to you</td></tr>
                            <tr><td className="p-3 font-bold">Flynn (text-first)</td><td className="p-3">Instant replies, booking and follow-up from the text</td></tr>
                        </tbody>
                    </table>
                </div>

                <h2>How to choose</h2>
                <p>A big team needs a proper CRM for the pipeline, no question. But the moment that decides whether you win a lead happens in a text while you're out, and that's where a CRM can't help, because you're not at a desk. A text assistant covers the live moment: instant reply, book the inspection, keep the follow-up going, then hand the record to your CRM.</p>

                <MessageFlynnCTA
                    headline="Never miss the live moment"
                    body="Flynn replies to enquiries the instant they land, books inspections and follows up buyers and vendors, all from a text, while you're showing a property."
                    mascot="phone"
                />

                <p>More in <Link to="/blog/admin-tips-for-real-estate-agents">how agents win more leads with less admin</Link> and <Link to="/blog/reply-to-leads-faster-speed-to-lead">speed to lead</Link>.</p>
            </>
        )
    },

    // ─── W3.7 Freelancers: admin ──────────────────────────────────────────────
    "admin-tips-for-freelancers": {
        title: "How Freelancers Can Spend Less Time on Admin and More on Work",
        date: "Jul 22, 2026",
        datePublished: "2026-07-22",
        readTime: "6 min read",
        category: "Guide",
        description: "Freelancers lose billable hours to proposals, invoicing and chasing late clients. Here's how to cut that admin down so you spend your time on paid work instead.",
        content: (
            <>
                <p className="text-xl text-gray-700 leading-relaxed mb-6">
                    As a freelancer, admin is time you don't get paid for. Every hour spent writing proposals, sending invoices and chasing late payers is an hour you can't bill. Here's how to shrink it.
                </p>

                <Hero pose="write" />

                <h2>The three admin sinks</h2>
                <div className="grid md:grid-cols-3 gap-6 my-8">
                    <div className="bg-white border-2 border-black p-6 text-center"><FileText className="text-brand-500 mx-auto mb-2" size={28} /><div className="font-bold">Proposals & quotes</div><p className="text-sm text-gray-600 mt-2">Re-writing the same scope and pricing for every lead.</p></div>
                    <div className="bg-white border-2 border-black p-6 text-center"><DollarSign className="text-brand-500 mx-auto mb-2" size={28} /><div className="font-bold">Invoicing</div><p className="text-sm text-gray-600 mt-2">Formatting invoices and tracking what's been paid.</p></div>
                    <div className="bg-white border-2 border-black p-6 text-center"><Clock className="text-brand-500 mx-auto mb-2" size={28} /><div className="font-bold">Chasing clients</div><p className="text-sm text-gray-600 mt-2">The awkward "just following up on that invoice" dance.</p></div>
                </div>

                <h2>The fixes</h2>
                <p><strong>Quote fast and clearly.</strong> The freelancer who replies same-day with a tidy quote usually wins over the one who takes three days. See <Link to="/blog/how-to-write-a-quote">writing a winning quote</Link>.</p>
                <p className="mt-4"><strong>Invoice on delivery.</strong> Send the invoice the moment you deliver, while the value is fresh. <Link to="/blog/send-invoice-from-your-phone">Even from your phone</Link>.</p>
                <p className="mt-4"><strong>Automate the chase.</strong> Late-paying clients are a freelancer's biggest cash-flow risk. Consistent reminders get you paid without the awkward email. <Link to="/blog/late-payment-reminder-templates">Templates here</Link>.</p>

                <MessageFlynnCTA
                    headline="Bill more, admin less"
                    body="Flynn drafts your quotes and invoices from a text and chases late clients automatically, in your voice. More billable hours, less unpaid admin."
                    mascot="thumbsup"
                />

                <p>See the toolkit in <Link to="/blog/best-apps-for-freelancers">best apps for freelancers</Link>.</p>
            </>
        )
    },

    // ─── W3.8 Freelancers: best apps ──────────────────────────────────────────
    "best-apps-for-freelancers": {
        title: "Best Apps for Freelancers in 2026 (Invoicing, Quotes & Admin)",
        date: "Jul 23, 2026",
        datePublished: "2026-07-23",
        readTime: "6 min read",
        category: "Comparison",
        description: "The best apps for freelancers in 2026 to handle invoicing, quotes, payments and chasing clients, plus the text-first assistant that does the admin for you.",
        content: (
            <>
                <p className="text-xl text-gray-700 leading-relaxed mb-6">
                    Freelancers don't need a 20-app stack. You need to quote, invoice, get paid, and chase the stragglers. Here's what's worth using in 2026.
                </p>

                <Hero pose="point" />

                <div className="overflow-x-auto my-8">
                    <table className="w-full border-2 border-black text-sm">
                        <thead className="bg-black text-white"><tr><th className="p-3 text-left font-display">Tool</th><th className="p-3 text-left font-display">Good for</th></tr></thead>
                        <tbody className="bg-white">
                            <tr className="border-b-2 border-black"><td className="p-3 font-bold">Wave / FreshBooks</td><td className="p-3">Invoicing and light accounting</td></tr>
                            <tr className="border-b-2 border-black"><td className="p-3 font-bold">Bonsai</td><td className="p-3">Proposals, contracts and invoicing in one</td></tr>
                            <tr className="border-b-2 border-black"><td className="p-3 font-bold">Xero</td><td className="p-3">Proper accounting as you grow</td></tr>
                            <tr><td className="p-3 font-bold">Flynn (text-first)</td><td className="p-3">Quotes, invoices and chasing, done from a text</td></tr>
                        </tbody>
                    </table>
                </div>

                <h2>How to choose</h2>
                <p>If you want contracts and proposals built in, Bonsai is strong. If you just want clean invoicing, Wave or FreshBooks do it well. But all of them are apps you open and drive. If the admin is the bit you avoid, a text assistant that quotes, invoices and chases for you (and files into your accounting tool) removes the friction that makes you put it off.</p>

                <MessageFlynnCTA
                    headline="The admin layer for freelancers"
                    body="Flynn turns a text into a quote or invoice, tracks what's unpaid, and chases late clients for you. Files into the accounting tool you already use."
                    mascot="thumbsup"
                />

                <p>More in <Link to="/blog/admin-tips-for-freelancers">how freelancers can cut admin</Link> and <Link to="/blog/chatgpt-for-small-business">ChatGPT for small business</Link>.</p>
            </>
        )
    },

    // ─── W3.9 Personal trainers: admin ────────────────────────────────────────
    "admin-tips-for-personal-trainers": {
        title: "How Personal Trainers Can Cut No-Shows and Admin",
        date: "Jul 24, 2026",
        datePublished: "2026-07-24",
        readTime: "6 min read",
        category: "Guide",
        description: "Personal trainers lose income to no-shows, session juggling and chasing payments. Here's how to keep sessions full, get paid on time, and spend less time on your phone.",
        content: (
            <>
                <p className="text-xl text-gray-700 leading-relaxed mb-6">
                    As a personal trainer your income is your calendar. A no-show is money gone, a missed rebooking is a client drifting away, and chasing session payments is the worst part of the week. Here's how to tighten all three.
                </p>

                <Hero pose="phone" />

                <h2>No-shows are lost income</h2>
                <p>An empty session slot is revenue you can't recover. Most no-shows are forgetfulness, so reminders fix the bulk of them: a confirmation on booking and a day-before nudge. Add a cancellation window and clients respect your time. Full guide in <Link to="/blog/how-to-reduce-no-shows-small-business">reducing no-shows</Link>.</p>

                <h2>Keep sessions booked ahead</h2>
                <p>The clients who book their next session before they leave are the ones who stick. A quick "same time next week?" in the text keeps your calendar full and your clients consistent, which is what gets them results and keeps them paying.</p>

                <h2>Payments and packages</h2>
                <p>Chasing for session or package payments is awkward when you see the client in person. Automatic, friendly reminders take you out of the uncomfortable part and get you paid on time. <Link to="/blog/late-payment-reminder-templates">Templates here</Link>.</p>

                <MessageFlynnCTA
                    headline="Keep every session booked and paid"
                    body="Flynn books sessions from the text, sends reminders to cut no-shows, nudges clients to rebook, and chases package payments, all in your voice."
                    mascot="phone"
                />

                <p>See the tools in <Link to="/blog/best-apps-for-personal-trainers">best apps for personal trainers</Link>.</p>
            </>
        )
    },

    // ─── W3.10 Personal trainers: best apps ───────────────────────────────────
    "best-apps-for-personal-trainers": {
        title: "Best Apps for Personal Trainers in 2026",
        date: "Jul 25, 2026",
        datePublished: "2026-07-25",
        readTime: "6 min read",
        category: "Comparison",
        description: "The best apps for personal trainers in 2026 for programming, booking and payments, plus the text-first assistant that keeps sessions booked and paid for you.",
        content: (
            <>
                <p className="text-xl text-gray-700 leading-relaxed mb-6">
                    Trainer software splits into two jobs: programming and coaching, and the business admin around it. Here's what's worth using in 2026 for each.
                </p>

                <Hero pose="point" />

                <div className="overflow-x-auto my-8">
                    <table className="w-full border-2 border-black text-sm">
                        <thead className="bg-black text-white"><tr><th className="p-3 text-left font-display">Tool</th><th className="p-3 text-left font-display">Good for</th></tr></thead>
                        <tbody className="bg-white">
                            <tr className="border-b-2 border-black"><td className="p-3 font-bold">Trainerize / TrueCoach</td><td className="p-3">Programming, tracking and client coaching</td></tr>
                            <tr className="border-b-2 border-black"><td className="p-3 font-bold">Mindbody</td><td className="p-3">Studios with classes and memberships</td></tr>
                            <tr className="border-b-2 border-black"><td className="p-3 font-bold">Square</td><td className="p-3">Booking plus taking payments</td></tr>
                            <tr><td className="p-3 font-bold">Flynn (text-first)</td><td className="p-3">Booking, reminders, rebooking and payment chasing by text</td></tr>
                        </tbody>
                    </table>
                </div>

                <h2>How to choose</h2>
                <p>For programming and tracking workouts, a coaching tool like Trainerize is purpose-built and worth it. But those tools aren't built for the business admin, the booking, the no-show reminders, the chasing. That's the bit that eats your evenings, and it's exactly what a text assistant handles, alongside the tools you already coach in.</p>

                <MessageFlynnCTA
                    headline="The business side, handled"
                    body="Flynn keeps sessions booked, cuts no-shows with reminders, nudges rebookings and chases payments, from a text, so you can focus on coaching."
                    mascot="thumbsup"
                />

                <p>More in <Link to="/blog/admin-tips-for-personal-trainers">how personal trainers cut no-shows and admin</Link>.</p>
            </>
        )
    },
};

/*
 * Expired posts — off-vertical SEO spray (salons, real estate, freelancers,
 * PTs) and generic "AI for small business" listicles that no longer match the
 * AI-receptionist-for-tradies direction (2026-07-22 pivot). Content stays in
 * the record as dormant data; these slugs are hidden from the index here, and
 * public/_redirects 301s their URLs to /blog so Google drops them cleanly.
 * Also removed from public/sitemap.xml.
 */
const EXPIRED_POSTS = new Set([
    'chatgpt-for-small-business',
    'best-ai-tools-for-small-business',
    'ai-tools-small-business-admin',
    'best-appointment-scheduling-app-small-business',
    'admin-tips-for-salons-and-barbers',
    'best-apps-for-hair-salons',
    'admin-tips-for-real-estate-agents',
    'best-apps-for-real-estate-agents',
    'admin-tips-for-freelancers',
    'best-apps-for-freelancers',
    'admin-tips-for-personal-trainers',
    'best-apps-for-personal-trainers',
]);

export const BlogList: React.FC = () => {
    return (
        <>
            <Helmet>
                <title>Blog - Flynn AI | Run Your Business From Text</title>
                <meta name="description" content="Guides for tradies and service businesses on running the admin from your messages, booking jobs, sending invoices and quotes by text, chasing payments and winning more leads." />
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
                    {Object.entries(blogPosts).filter(([slug]) => !EXPIRED_POSTS.has(slug)).map(([slug, post]) => (
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
    // Expired slugs 301 at the edge (_redirects); this guard covers client-side
    // navigation and any cached SPA shell.
    const post = EXPIRED_POSTS.has(slug || "") ? undefined : blogPosts[slug || ""];

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

                    <div className="blog-content">
                        {post.content}
                    </div>
                </div>
            </article>
        </>
    );
};
