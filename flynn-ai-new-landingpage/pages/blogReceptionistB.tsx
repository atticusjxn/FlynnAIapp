import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, XCircle } from 'lucide-react';
import SmartStoreCTA from '../components/SmartStoreCTA';
import type { BlogPostEntry } from './Blog';

// Small mascot banner, matches the convention used in Blog.tsx. Kept local to
// this file to avoid a circular import (Blog.tsx imports this file's record).
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

const receptionistPostsB: Record<string, BlogPostEntry> = {
    // ─── AI receptionist for plumbers (AU) ─────────────────────────────────────
    "ai-receptionist-for-plumbers-australia": {
        title: "AI Receptionist for Plumbers: The Complete 2026 Guide (AU)",
        date: "Jul 26, 2026",
        datePublished: "2026-07-26",
        readTime: "9 min read",
        category: "Trade guide",
        description: "How an AI receptionist answers, qualifies and books plumbing calls in Australia, then invoices the job and chases the payment. Setup, pricing and a worked example.",
        content: (
            <>
                <p className="text-xl text-gray-700 leading-relaxed mb-6">
                    An AI receptionist for plumbers answers the phone with a real conversation, works out whether the caller needs an emergency callout or a quote, books the job into your calendar and texts a confirmation, all while you're still under the sink. This guide covers exactly how that works for a plumbing business in Australia, what it costs compared to a human answering service, and how to set it up.
                </p>

                <Hero pose="phone" />

                <h2>Why plumbing calls are different</h2>
                <p>Plumbing is one of the worst trades to be mid-job when the phone rings. You're under a sink with your hands wet, or you're elbow-deep in a wall cavity chasing a leak, and there's genuinely no clean way to stop and answer. Add to that the fact that a huge share of plumbing calls are urgent: a burst pipe, an overflowing toilet, hot water out on a Sunday. The caller isn't browsing. They're standing in a wet kitchen with a phone in one hand.</p>
                <p className="mt-4">That urgency changes caller behaviour. Someone with water coming through their ceiling doesn't leave one voicemail and wait patiently. Industry surveys on missed-call behaviour consistently put it around eight in ten callers moving straight to the next number in the list when a call isn't answered, and for a burst-pipe emergency that next call usually gets picked up within a couple of rings. If you're the third plumber they try, you've lost a job you never even knew existed. We've broken down the full revenue math for this in <Link to="/blog/missed-calls-cost-australian-tradies">the real cost of missed calls for Australian tradies</Link>.</p>

                <h2>What Flynn actually does when it answers</h2>
                <p>This is the part that's easy to get wrong from the outside, so it's worth being precise. Flynn doesn't play a phone tree and it doesn't just fire off an SMS. It answers the call with a natural Australian voice and has an actual conversation with the caller, the same way a sharp receptionist would if you had one sitting at a desk.</p>
                <p className="mt-4">A typical call goes something like this: the caller explains what's wrong, Flynn asks the follow-up questions that matter (is water actively leaking, is it a burst pipe or a slow drip, is anyone home, what suburb), works out on the fly whether this is an emergency that needs someone dispatched today or a job that can wait for a quote, and books it straight into your calendar. The caller gets a text confirming the time and what to expect. You get a job on your calendar instead of a missed-call notification.</p>
                <p className="mt-4">The bit that actually matters for your bank account happens after the call. Once the job's done, Flynn puts together the invoice with the job photos attached, sends the client a pay link, and chases it automatically until it's paid. No answering service anywhere does that last part, because none of them touch your invoicing. For a plumber, where jobs are often one-off and clients aren't always great at paying promptly, that chase loop is worth more over a year than the call answering itself.</p>

                <h2>Emergency vs quote, sorted in the conversation</h2>
                <p>A lot of what people assume an AI receptionist needs is a rigid decision tree: press this for that. Flynn doesn't work that way. Because it's an actual conversation, it reads context the way a person would. "There's water coming through the light fitting" gets treated very differently to "my downstairs toilet's been running a bit loud, can someone have a look sometime this week". The caller never has to know they're being triaged, they're just talking, and the right outcome falls out of the conversation.</p>

                <h2>What it costs versus a human answering service</h2>
                <p>Human virtual receptionist services for AU tradies typically sit somewhere between $135 and $500 or more a month, and most only cover business hours, meaning the 6pm burst pipe still goes to voicemail unless you pay for an after-hours add-on. They also don't book the job into your system, they take a message and hand it to you to call back, which puts you right back to competing with whoever the caller tries next.</p>
                <p className="mt-4">Flynn is free to start, answers around the clock, and books the job itself rather than handing you a message slip. That's a genuinely different category of product, not a cheaper version of the same thing. See the full breakdown in <Link to="/blog/ai-receptionist-vs-virtual-receptionist-plumbers">AI receptionist vs virtual receptionist for plumbers</Link>.</p>

                <SmartStoreCTA
                    headline="Never lose another emergency callout"
                    body="Flynn answers your plumbing calls in a real Australian voice, books the job, then invoices it with the photos and chases the payment till it lands. Free to start."
                />

                <h2>Setting it up</h2>
                <p>Setup is two steps. First, download the Flynn iOS app and set up your business (services, rough pricing, coverage area). Second, divert your calls to your Flynn number using your carrier's conditional call forwarding, so calls only reach Flynn when you don't pick up, or all the time if you'd rather Flynn screen everything. We've written the exact steps for the two big AU carriers: <Link to="/blog/call-forwarding-telstra-missed-call-sms">Telstra call forwarding codes</Link> and <Link to="/blog/call-forwarding-optus-missed-call-sms">Optus call forwarding codes</Link>. Neither takes more than a couple of minutes.</p>

                <h2>A worked example</h2>
                <p>Take a one-person plumbing outfit that misses roughly three emergency calls a month, which is a conservative number for anyone who's regularly under a house or driving between jobs. An emergency callout in most AU markets sits somewhere between $180 and $400 once you factor the after-hours premium. Recovering those three calls a month is somewhere around $600 to $1,200 in jobs that were previously walking to a competitor, before you even count the repeat business and referrals that come from being the plumber who actually answered.</p>
                <p className="mt-4">Layer the invoicing and payment-chasing loop on top and the bigger win isn't just the extra jobs, it's not having to remember to invoice at all, and not having to send an awkward "hey, did you get my invoice" text a fortnight later. If that side of the business is where you lose the most time, <Link to="/blog/chase-unpaid-invoices-without-awkward-calls">chasing unpaid invoices without the awkward calls</Link> is worth a read too.</p>

                <h2>Is it right for your plumbing business</h2>
                <p>If you're a solo plumber or run a small crew and you're the one answering (or not answering) the phone between jobs, this is built for exactly that situation. If you run a large team with a dedicated office manager already fielding calls during business hours, the bigger win is probably just the after-hours and weekend coverage, plus the invoicing loop, rather than replacing daytime reception entirely.</p>

                <h2>What the caller experiences</h2>
                <p>It's worth thinking about this from the customer's side too, because a bad experience here can cost you a job even if the phone did technically get answered. Nobody wants to talk to a robotic voice reading a script, and nobody wants to be stuck in a menu when their kitchen is filling with water. What actually reassures a caller in a plumbing emergency is being heard, someone (or something that sounds like someone) asking the right questions quickly and confirming help is coming. That's the bar Flynn is built to clear, a conversation that sounds like a real local business, not an automated system reading options at them.</p>
                <p className="mt-4">After the call, the caller gets a text confirming the booking, the time window, and what to expect, the same kind of confirmation you'd get from any well-run trade business. There's no confusion about whether the call "actually worked", they can see it in writing straight away.</p>

                <h2>Common questions plumbers ask before switching</h2>
                <p>The two questions that come up most are whether it sounds robotic, and whether it'll actually get pricing right for a trade as varied as plumbing. On the first, the voice is designed to sound like a real Australian receptionist rather than a synthetic assistant, and most callers don't realise they aren't talking to a person until well into the call, if at all. On the second, Flynn learns your actual pricing and services during setup rather than guessing, so a callout fee quote or an emergency premium reflects what you actually charge, not a generic industry average.</p>
            </>
        ),
        faqs: [
            {
                q: "Does an AI receptionist actually talk to the caller, or just send a text?",
                a: "Flynn answers the call and has a real conversation in a natural Australian voice. It's not a text-back app and it's not a phone menu, it talks to the caller, works out what they need, and books the job before the call ends.",
            },
            {
                q: "How does it tell an emergency apart from a routine quote?",
                a: "It reads the conversation the same way a receptionist would, asking a couple of natural follow-up questions about what's happening and how urgent it is, then books accordingly. There's no menu the caller has to navigate.",
            },
            {
                q: "What happens after the job is booked?",
                a: "Once the job is done, Flynn puts together the invoice with the job photos attached, sends a pay link, and follows up automatically until it's paid. That loop is what most answering services don't touch.",
            },
            {
                q: "How much does it cost compared to a human answering service?",
                a: "AU human answering services usually run $135 to $500 or more a month and mostly cover business hours only. Flynn is free to start and answers around the clock, though it's solving a different job since it also books directly rather than taking a message.",
            },
            {
                q: "How do I actually set it up?",
                a: "Download the Flynn iOS app, set up your business details, then divert your calls to your Flynn number using your carrier's forwarding code. Both the Telstra and Optus setup guides walk through the exact codes.",
            },
        ],
    },

    // ─── AI receptionist for electricians (AU) ─────────────────────────────────
    "ai-receptionist-for-electricians-australia": {
        title: "AI Receptionist for Electricians: Stop Missing Emergency Calls",
        date: "Jul 27, 2026",
        datePublished: "2026-07-27",
        readTime: "8 min read",
        category: "Trade guide",
        description: "How electricians in Australia use an AI receptionist to answer calls safely, tell emergencies from quotes, book the job and get paid faster. Setup guide included.",
        content: (
            <>
                <p className="text-xl text-gray-700 leading-relaxed mb-6">
                    Electricians can't answer the phone with a live panel open or a hand on a circuit, which means the calls that need answering fastest are exactly the ones you're least able to pick up. An AI receptionist fixes that by answering for you, working out what the caller actually needs, and booking the job while you finish the job in front of you.
                </p>

                <Hero pose="phone" />

                <h2>Safety-first means phone-last</h2>
                <p>This one's obvious to anyone in the trade but worth spelling out. You don't stop mid-way through isolating a circuit to grab your phone out of a pocket with one glove off. You don't leave a live panel to answer a call from a number you don't recognise. The nature of the work means the phone is always going to lose to the job in front of you, and that's exactly as it should be. The problem isn't your judgement, it's that nothing was covering the phone while you made the right call.</p>

                <h2>The three kinds of calls you're missing</h2>
                <p>Missed calls to an electrician generally split into three rough buckets. There's the genuine emergency (power out, a burning smell, sparks from a switchboard), which needs someone dispatched fast and usually carries an after-hours premium. There's the quote call (a reno, a new circuit, an EV charger install), which is high value but not urgent and can wait a day without losing the job, provided you actually call back. And there's the routine stuff (a light that needs fixing, a smoke alarm swap), which is real revenue but the caller will often just try the next name if you don't pick up.</p>
                <p className="mt-4">The expensive mistake is treating all three the same. A missed after-hours emergency call for electrical work can mean a job worth $1,500 to $3,000 once the emergency premium and full scope of work are counted, walking straight to whichever electrician answers first. We go deeper on the dollar figures across trades in <Link to="/blog/missed-calls-cost-australian-tradies">the real cost of missed calls for Australian tradies</Link>.</p>

                <h2>How the conversation sorts it out</h2>
                <p>Because Flynn answers with a real voice and has an actual conversation rather than running a menu, it naturally works out which of the three buckets a call falls into. "There's smoke coming from the switchboard" gets read completely differently to "I'm renovating the kitchen in a few months and want a quote for new points". The caller just talks normally, the urgency comes through in what they're actually saying, and Flynn books accordingly, dispatching-today language for the genuine emergency, a scheduled callback or quote slot for everything else.</p>

                <SmartStoreCTA
                    headline="Let Flynn take the call while you're on the tools"
                    body="Flynn answers electrical callouts in a natural Australian voice, works out emergency versus quote, books the job, then invoices it with photos and chases the payment."
                />

                <h2>What happens after the call</h2>
                <p>The call answering is only half of it. Once the job's wrapped, Flynn drafts the invoice with the job photos attached (handy for anything that needs to show compliance or before/after work), sends the client a pay link, and keeps chasing automatically until it clears. For electricians doing a mix of emergency callouts and scheduled installs, that means the after-hours job that got booked at 11pm doesn't also become the invoice you forget to send. If unpaid invoices are already a headache, <Link to="/blog/chase-unpaid-invoices-without-awkward-calls">chasing unpaid invoices without the awkward calls</Link> covers the rest of that loop.</p>

                <h2>Setting it up</h2>
                <p>Download the Flynn iOS app, set up your business (your services, rough call-out and hourly pricing, your coverage area), then divert your calls to your Flynn number so calls land with Flynn when you don't answer, or all the time if you want every call screened first. The forwarding step takes a couple of minutes on either major AU carrier, see <Link to="/blog/call-forwarding-telstra-missed-call-sms">the Telstra how-to</Link> or <Link to="/blog/call-forwarding-optus-missed-call-sms">the Optus how-to</Link> for the exact codes.</p>

                <h2>Worth comparing to the alternatives</h2>
                <p>If you've looked at a human answering service before, the honest tradeoffs between that and an AI receptionist are worth reading properly rather than taking on faith, see <Link to="/blog/ai-receptionist-vs-virtual-receptionist-plumbers">AI receptionist vs virtual receptionist</Link> for the full comparison (the logic holds for electricians as much as plumbers). And if you want the wider picture of what a phone-answering AI can and can't replace, <Link to="/blog/best-ai-assistant-for-tradies-2026">the best AI assistant for tradies in 2026</Link> is a good next read.</p>

                <h2>The after-hours premium, in real numbers</h2>
                <p>Electrical work has one of the widest gaps between a daytime rate and an after-hours emergency rate of any trade, which is exactly why missing the after-hours call hurts more than missing a daytime one. A weekday callout might sit at a fairly standard hourly rate, but a genuine after-hours emergency, say 9pm on a Saturday for a dead switchboard, commonly carries a premium on top of the base rate once you factor the emergency loading and any parts needed on the spot. Multiply that by even a handful of missed after-hours calls a month and it adds up to real money walking to whichever electrician's phone actually rings through.</p>
                <p className="mt-4">The quote calls matter just as much long term, even though they feel less urgent in the moment. A missed quote call for an EV charger install or a full rewire doesn't just cost you that one job, it costs you the referral and repeat work that tends to follow a good relationship with that client over the years.</p>

                <h2>Why the conversation matters more than a script</h2>
                <p>A common worry electricians raise before trying this is whether an automated system can be trusted to get the triage right, given the stakes. The honest answer is that Flynn isn't running a fixed script or a decision tree, it's genuinely parsing what the caller says and asking sensible follow-up questions, the same instinct a good office manager would use. That matters because real callers don't describe problems the way a checklist expects. Someone might undersell how serious something is, or overstate a minor issue out of anxiety, and a natural conversation handles both of those better than a rigid set of options ever could.</p>

                <h2>What it costs versus doing nothing</h2>
                <p>It's easy to underestimate how much a "do nothing" approach actually costs, because a missed call doesn't show up on any invoice, it just quietly disappears. Most electricians already know roughly how many calls they miss in a busy week, they just haven't put a dollar figure next to it. Once you do the maths, weighing a handful of missed after-hours emergencies and a couple of missed quote calls against free-to-start coverage that answers every time, the case for at least trying it tends to make itself.</p>
            </>
        ),
        faqs: [
            {
                q: "Can an AI receptionist tell the difference between an emergency and a routine call?",
                a: "Yes, because it's a real conversation rather than a menu. The caller describes what's happening in their own words and Flynn reads the urgency from that, the same way a person answering the phone would.",
            },
            {
                q: "Is it safe to rely on for genuine electrical emergencies?",
                a: "Flynn's job is to answer, qualify and book fast so a genuine emergency gets dispatched without delay. It doesn't replace your own judgement about what needs immediate attention, it just makes sure the call gets answered and the job gets booked the moment it comes in, day or night.",
            },
            {
                q: "Does it handle quote calls differently to emergency calls?",
                a: "Yes. A renovation or new-circuit quote call gets booked as a scheduled callback or quote slot rather than treated as urgent, so you're not being pulled off a live job for something that can genuinely wait.",
            },
            {
                q: "What does Flynn do once the job is finished?",
                a: "It puts together the invoice with the job photos attached, sends the client a pay link, and follows up automatically until it's paid, which is the part most answering services never touch.",
            },
            {
                q: "How do I connect my existing business number?",
                a: "You keep your existing number and use your carrier's conditional call forwarding to divert calls to your Flynn number, either only when you don't answer or all the time. Both the Telstra and Optus guides list the exact forwarding codes.",
            },
        ],
    },

    // ─── AI receptionist vs virtual receptionist (comparison) ──────────────────
    "ai-receptionist-vs-virtual-receptionist-plumbers": {
        title: "AI Receptionist vs Virtual Receptionist for Plumbers: 2026",
        date: "Jul 28, 2026",
        datePublished: "2026-07-28",
        readTime: "7 min read",
        category: "Comparison",
        description: "An honest 2026 comparison of AI receptionists and human virtual receptionist services for plumbers: cost, hours covered, what each actually does after the call.",
        content: (
            <>
                <p className="text-xl text-gray-700 leading-relaxed mb-6">
                    A virtual receptionist and an AI receptionist solve the same surface problem, someone else answers your phone, but they work very differently and cost very differently. Here's an honest look at both, including where the human service still wins.
                </p>

                <Hero pose="thinking" />

                <h2>What a human virtual receptionist actually does</h2>
                <p>Services like the well-known AU answering companies put a real person on the other end of your calls during business hours. That's a genuine strength, a trained human is good at reading a difficult conversation and sounding professional. The catch is what they don't do: most of these services take a message and pass it to you, they don't book the job into your calendar or your job-management system, and coverage is usually business-hours-only unless you pay extra for after-hours, which is exactly when plumbing emergencies happen. Pricing typically runs $135 to $500 or more a month depending on call volume and hours covered.</p>

                <h2>What an AI receptionist does differently</h2>
                <p>Flynn answers the call itself with a natural Australian voice and has a real conversation, working out whether it's an emergency or a quote, and books the job directly into your calendar before the call ends. The caller gets a text confirmation. There's no message left for you to action later, the booking is already done. Then, separate to the call itself, Flynn runs the money side of the job: an invoice with the job photos attached, a pay link, and automatic chasing until it's paid. That whole back-half doesn't exist in a human answering service at all, because they're only ever answering the phone, not touching your invoicing.</p>
                <p className="mt-4">It's also available 24/7 without an after-hours surcharge, and it's free to start, compared with the ongoing monthly cost of a human service.</p>

                <h2>Side by side</h2>
                <div className="not-prose overflow-x-auto my-8">
                    <table className="w-full border-2 border-black text-sm">
                        <thead className="bg-black text-white">
                            <tr>
                                <th className="p-3 text-left font-display">What matters</th>
                                <th className="p-3 text-left font-display">Virtual receptionist (human)</th>
                                <th className="p-3 text-left font-display">Flynn (AI receptionist)</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white">
                            <tr className="border-b-2 border-black">
                                <td className="p-3 font-bold">Answers the call live</td>
                                <td className="p-3"><CheckCircle className="text-green-600" size={18} /> Yes, a real person</td>
                                <td className="p-3"><CheckCircle className="text-green-600" size={18} /> Yes, a natural AI voice</td>
                            </tr>
                            <tr className="border-b-2 border-black">
                                <td className="p-3 font-bold">Hours covered</td>
                                <td className="p-3">Usually business hours, after-hours costs extra</td>
                                <td className="p-3"><CheckCircle className="text-green-600" size={18} /> 24/7</td>
                            </tr>
                            <tr className="border-b-2 border-black">
                                <td className="p-3 font-bold">Books the job directly</td>
                                <td className="p-3"><XCircle className="text-red-500" size={18} /> Takes a message instead</td>
                                <td className="p-3"><CheckCircle className="text-green-600" size={18} /> Books into your calendar</td>
                            </tr>
                            <tr className="border-b-2 border-black">
                                <td className="p-3 font-bold">Invoices the job after</td>
                                <td className="p-3"><XCircle className="text-red-500" size={18} /></td>
                                <td className="p-3"><CheckCircle className="text-green-600" size={18} /> With job photos + pay link</td>
                            </tr>
                            <tr className="border-b-2 border-black">
                                <td className="p-3 font-bold">Chases unpaid invoices</td>
                                <td className="p-3"><XCircle className="text-red-500" size={18} /></td>
                                <td className="p-3"><CheckCircle className="text-green-600" size={18} /> Automatically</td>
                            </tr>
                            <tr>
                                <td className="p-3 font-bold">Monthly cost</td>
                                <td className="p-3">$135–$500+</td>
                                <td className="p-3"><CheckCircle className="text-green-600" size={18} /> Free to start</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <SmartStoreCTA
                    headline="See the difference on your own calls"
                    body="Flynn answers, books and invoices the job in one loop, no message-taking, no after-hours surcharge. Free to start on iOS."
                />

                <h2>When a human service still makes sense</h2>
                <p>There are situations where a human virtual receptionist is genuinely the better fit. If a lot of your calls are complex customer-service conversations that need real judgement and a lot of back-and-forth (disputes, complicated commercial accounts, VIP clients who expect a familiar voice), a trained person handles nuance an AI still can't match perfectly. And if you already have a full-time office manager fielding calls during business hours and just need occasional overflow cover, a human overflow service can slot in without changing your workflow.</p>
                <p className="mt-4">For most solo plumbers and small crews though, the calls that matter most are exactly the ones a human service handles worst: after-hours emergencies, and the fact that a message left for you to call back later loses the caller to whoever answers next. That's the specific gap an AI receptionist that talks, books and invoices is built to close. For the fuller cost picture across AU trades, see <Link to="/blog/missed-calls-cost-australian-tradies">the real cost of missed calls for Australian tradies</Link>, and for the plumbing-specific setup walkthrough, <Link to="/blog/ai-receptionist-for-plumbers-australia">AI receptionist for plumbers</Link>. If electrical work is more your trade, the same logic is covered in <Link to="/blog/ai-receptionist-for-electricians-australia">AI receptionist for electricians</Link>.</p>

                <h2>What it actually feels like on the phone</h2>
                <p>One thing worth addressing directly: plenty of business owners assume "AI receptionist" means a robotic voice reading a script, the way a lot of the older phone-tree systems sounded. Flynn is built to sound like a real Australian receptionist having a normal conversation, not a synthetic voice working through a checklist. Most callers respond to it the way they'd respond to any competent person answering the phone, they explain the problem, get asked a couple of sensible follow-up questions, and get a time booked in.</p>
                <p className="mt-4">A human virtual receptionist obviously clears that bar too, since it's an actual person. The difference shows up in what happens next: the human service ends the call with a message for you to action, while Flynn ends the call with the job already sitting in your calendar and a confirmation already sent to the client.</p>

                <h2>The bottom line</h2>
                <p>If what you need is a live human voice handling complex conversations during business hours and you're not fussed about after-hours coverage or direct booking, a virtual receptionist is a fair, professional option. If what you actually lose money on is missed emergency calls outside business hours and invoices that don't get chased, an AI receptionist that answers, books and follows the money through to payment closes a gap the human services were never built to cover.</p>
            </>
        ),
        faqs: [
            {
                q: "Is a human virtual receptionist better than an AI one?",
                a: "It depends what you need. A human is better for complex, nuanced conversations. An AI receptionist like Flynn is better for round-the-clock coverage, direct booking rather than message-taking, and for actually following the job through to an invoice and payment.",
            },
            {
                q: "Do virtual receptionist services book the job for me?",
                a: "Most take a message and leave the booking to you to sort out afterwards. Flynn books the job into your calendar during the call itself, so there's nothing left for you to action.",
            },
            {
                q: "What's the typical cost of a human answering service in Australia?",
                a: "AU virtual receptionist services generally run somewhere between $135 and $500 or more a month depending on call volume and whether after-hours cover is included.",
            },
            {
                q: "Does Flynn cover after-hours calls?",
                a: "Yes, it answers 24/7 without an after-hours surcharge, which matters most for trades like plumbing and electrical where a lot of the highest-value jobs come in outside business hours.",
            },
            {
                q: "What happens to the invoice after the job's done?",
                a: "Flynn drafts the invoice with the job photos attached, sends a pay link, and chases it automatically until it's paid, a step no human answering service touches since they only handle the phone call.",
            },
        ],
    },

    // ─── Best missed-call / AI receptionist apps roundup ───────────────────────
    "best-missed-call-app-small-business-australia": {
        title: "Best Missed-Call & AI Receptionist Apps in Australia (2026)",
        date: "Jul 29, 2026",
        datePublished: "2026-07-29",
        readTime: "9 min read",
        category: "Comparison",
        description: "An honest 2026 roundup of missed-call and AI receptionist apps for Australian small businesses: what each actually does, who it suits, and what to check before you pick one.",
        content: (
            <>
                <p className="text-xl text-gray-700 leading-relaxed mb-6">
                    "Missed call app" covers a few genuinely different products, from a simple auto-text through to an AI that answers and has a conversation. Here's an honest 2026 roundup of what's actually available to Australian small businesses, what each one does, and which is worth your time.
                </p>

                <Hero pose="peek" />

                <h2>What to actually look for</h2>
                <p>Before comparing products, it's worth being clear on what separates a genuinely useful tool from a gimmick. The main things to check: does it actually answer the call and talk to the caller, or does it just fire off a text after the fact? Does it support Australian numbers and understand an Australian accent, or is it built for a US market and awkward here? Does it book the job directly, or just hand you a message to action later? And what does it cost, both up front and once you factor in the hours it doesn't cover.</p>

                <h2>Flynn</h2>
                <p>Flynn answers the call itself with a natural Australian voice and has a real conversation, qualifying whether it's an emergency or a routine job and booking it straight into your calendar. It's built AU-first, both for the accent it speaks in and the way it prices and books local trade work. After the call, it does the part none of the others touch: invoicing the job with the photos attached, sending a pay link, and chasing it automatically until it's paid. It's free to start, which matters given most of the alternatives below charge a recurring fee before you've proven the fit.</p>
                <p className="mt-4">Best for: solo tradies and small crews who miss calls while on the tools and want the whole loop, answer, book, invoice, get paid, handled without them touching a phone.</p>

                <h2>Generic missed-call auto-text apps</h2>
                <p>A cluster of apps, mostly built for the US market, send an automatic text reply the moment a call goes unanswered. They're cheap and simple, and for a business that just needs "sorry we missed you, here's our number" that can be enough. The limitation is that they don't answer the call, they only react after it's already gone to voicemail, and the reply is a generic template rather than a conversation that actually works out what the caller needs. Most also aren't built with Australian numbers or context in mind, so setup and support can be clunky for AU users.</p>
                <p className="mt-4">Best for: businesses that just want a polite auto-reply and don't need the call itself answered or the job booked.</p>

                <h2>Human answering services (e.g. OfficeHQ-style virtual receptionists)</h2>
                <p>Services like OfficeHQ put a real person on your calls, which is genuinely valuable for complex or sensitive conversations. The tradeoffs are cost and coverage: pricing for AU virtual receptionist services typically runs $135 to $500 or more a month, coverage is usually business-hours-only unless you pay for after-hours add-ons, and most take a message for you to action rather than booking the job themselves. For a full breakdown of this comparison, see <Link to="/blog/ai-receptionist-vs-virtual-receptionist-plumbers">AI receptionist vs virtual receptionist</Link>.</p>
                <p className="mt-4">Best for: businesses with complex customer conversations who need a trained human voice and don't mind the monthly cost or the business-hours limit.</p>

                <h2>DIY iOS Shortcuts</h2>
                <p>Some business owners rig up an iOS Shortcut to send an auto-reply text when a call is missed. It's free and it's better than nothing, but it's genuinely unreliable: it typically needs manual triggering or specific conditions to fire, doesn't book anything, and breaks the moment Apple changes something in an iOS update. It also can't have a conversation or tell an emergency from a routine enquiry, it just sends the same canned text every time.</p>
                <p className="mt-4">Best for: a stopgap if you've got nothing else in place and want a free five-minute fix, not a long-term solution.</p>

                <SmartStoreCTA
                    headline="Skip the stopgaps, answer properly"
                    body="Flynn answers your calls in a real Australian voice, books the job, then invoices it with photos and chases the payment. Free to start, built for AU trades."
                />

                <h2>Head to head</h2>
                <div className="not-prose overflow-x-auto my-8">
                    <table className="w-full border-2 border-black text-sm">
                        <thead className="bg-black text-white">
                            <tr>
                                <th className="p-3 text-left font-display"></th>
                                <th className="p-3 text-left font-display">Answers the call</th>
                                <th className="p-3 text-left font-display">Books the job</th>
                                <th className="p-3 text-left font-display">Invoices + chases pay</th>
                                <th className="p-3 text-left font-display">Cost</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white">
                            <tr className="border-b-2 border-black">
                                <td className="p-3 font-bold">Flynn</td>
                                <td className="p-3"><CheckCircle className="text-green-600" size={18} /></td>
                                <td className="p-3"><CheckCircle className="text-green-600" size={18} /></td>
                                <td className="p-3"><CheckCircle className="text-green-600" size={18} /></td>
                                <td className="p-3">Free to start</td>
                            </tr>
                            <tr className="border-b-2 border-black">
                                <td className="p-3 font-bold">Auto-text apps</td>
                                <td className="p-3"><XCircle className="text-red-500" size={18} /></td>
                                <td className="p-3"><XCircle className="text-red-500" size={18} /></td>
                                <td className="p-3"><XCircle className="text-red-500" size={18} /></td>
                                <td className="p-3">Low monthly fee</td>
                            </tr>
                            <tr className="border-b-2 border-black">
                                <td className="p-3 font-bold">Human answering service</td>
                                <td className="p-3"><CheckCircle className="text-green-600" size={18} /></td>
                                <td className="p-3">Takes a message</td>
                                <td className="p-3"><XCircle className="text-red-500" size={18} /></td>
                                <td className="p-3">$135–$500+/mo</td>
                            </tr>
                            <tr>
                                <td className="p-3 font-bold">DIY iOS Shortcut</td>
                                <td className="p-3"><XCircle className="text-red-500" size={18} /></td>
                                <td className="p-3"><XCircle className="text-red-500" size={18} /></td>
                                <td className="p-3"><XCircle className="text-red-500" size={18} /></td>
                                <td className="p-3">Free</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <h2>What "AU-native" actually changes</h2>
                <p>It's easy to wave this away as a branding detail, but it changes real outcomes. A caller who hears an obviously American voice or gets asked questions phrased around US conventions (area codes, US-style pricing assumptions) tends to hang up faster, because it doesn't sound like a real local business. Flynn is built around Australian phone numbers, Australian trade pricing conventions, and a voice that sounds like it belongs to the business it's answering for. For a category where trust is built in the first ten seconds of a call, that's not a minor detail.</p>

                <h2>A quick gut check before you pick one</h2>
                <p>If you're not sure which category fits, ask yourself three things. First, how many of your missed calls are genuinely urgent versus just routine enquiries, since that changes how much value there is in something that actually books the job rather than just texting back. Second, how much time do you currently lose chasing invoices after a job, since that's a cost none of the auto-text or DIY options touch at all. Third, what would it actually cost you to test the AI receptionist option properly, given it's free to start, versus committing to a monthly human-service contract before you know your real call volume.</p>

                <h2>The honest verdict</h2>
                <p>None of these are one-size-fits-all. If you just want a polite auto-reply and nothing else, a generic auto-text app or even a DIY Shortcut will do, though don't expect it to book anything or handle an emergency well. If your calls are genuinely complex and you're not fussed about the monthly cost, a human answering service is a fair, professional option. If what's actually costing you money is missed emergency and after-hours calls that go to a competitor, and invoices that don't get chased once the job's done, that's specifically what Flynn is built to close, and it's free to start, so testing it against your real call volume costs nothing.</p>
                <p className="mt-4">For the deeper dive on how this looks trade by trade, see <Link to="/blog/ai-receptionist-for-plumbers-australia">AI receptionist for plumbers</Link> and <Link to="/blog/ai-receptionist-for-electricians-australia">AI receptionist for electricians</Link>, and for the numbers behind why this matters in the first place, <Link to="/blog/missed-calls-cost-australian-tradies">the real cost of missed calls for Australian tradies</Link>.</p>
            </>
        ),
        faqs: [
            {
                q: "What's the difference between a missed-call text-back app and an AI receptionist?",
                a: "A text-back app reacts after a call has already gone unanswered by sending a template text. An AI receptionist like Flynn answers the call itself, has a real conversation, and books the job before the call even ends.",
            },
            {
                q: "Are most missed-call apps built for Australia?",
                a: "No, most of the auto-text category is built for the US market and can be clunky with Australian numbers or context. Flynn is built AU-first, both in the voice it uses and how it prices and books local trade work.",
            },
            {
                q: "Is a human answering service worth it compared to an AI receptionist?",
                a: "It depends on your calls. A human service suits complex, nuanced conversations and typically costs $135 to $500 or more a month with business-hours-only coverage. An AI receptionist answers 24/7, books directly instead of taking a message, and also handles invoicing and payment chasing.",
            },
            {
                q: "Can a free DIY iOS Shortcut replace a proper missed-call solution?",
                a: "It's a reasonable stopgap but unreliable long term. It typically needs manual triggering, sends the same canned text regardless of what the caller needs, can't book anything, and tends to break with iOS updates.",
            },
            {
                q: "Does Flynn do anything after the call is booked?",
                a: "Yes. Once the job's done, Flynn puts together the invoice with the job photos attached, sends a pay link, and chases it automatically until it's paid, which is the loop that sets it apart from every other option in this roundup.",
            },
        ],
    },
};

export default receptionistPostsB;
