import React from 'react';
import { Link } from 'react-router-dom';
import SmartStoreCTA from '../components/SmartStoreCTA';
import type { BlogPostEntry } from './Blog';

// Small mascot banner, same convention as Blog.tsx.
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

const receptionistPostsA: Record<string, BlogPostEntry> = {
    // ─── missed-calls-cost-australian-tradies ──────────────────────────────────
    "missed-calls-cost-australian-tradies": {
        title: "The Real Cost of Missed Calls for Aussie Tradies (2026)",
        date: "Jul 22, 2026",
        datePublished: "2026-07-22",
        readTime: "8 min read",
        category: "Money",
        description: "Australian tradies miss thousands of dollars a year to unanswered calls. Here's the real AUD math, what answering services charge, and what actually fixes it.",
        content: (
            <>
                <p className="text-xl text-gray-700 leading-relaxed mb-6">
                    A missed call for a tradie isn't a missed chat, it's a missed job. If you're under a house or up a ladder when the phone rings, the caller doesn't wait around, they ring the next name on the list. Here's what that actually costs an Australian trade business in a year, in real dollars.
                </p>

                <Hero pose="phone" />

                <h2>What a missed call is actually worth</h2>
                <p>Every trade has a different number attached to "the phone rang and nobody answered". Rough AU averages:</p>
                <ul>
                    <li><strong>Plumber callout:</strong> $180–$350 per job, more after hours or on a burst pipe</li>
                    <li><strong>Electrician:</strong> $150–$300 an hour, and a single job often runs two or three hours</li>
                    <li><strong>HVAC:</strong> $200–$600 per job, and it spikes hard over a hot summer</li>
                </ul>
                <p>None of that is a one-off. A missed call is usually a missed relationship too, the same customer would have called you again for the next job and probably referred a mate. You're not just losing today's callout, you're losing the repeat customer.</p>

                <h2>How many calls actually go missing</h2>
                <p>Think about a normal day on the tools. You're under a sink, up a roof, or elbow deep in a switchboard, hands full, ear protection in, engine running. You physically can't get to the phone in time, and by the time you've wiped your hands and checked the missed call, the caller has already rung someone else. Tradies who track it honestly find they miss somewhere between 3 and 8 calls a week during a normal working week, more during busy season.</p>
                <p className="mt-4">Voicemail doesn't save most of those calls either. Plenty of callers won't leave a message at all, they just hang up and try the next tradie on the search results page. If your voicemail greeting is the only thing catching those calls, you're relying on a habit most people don't have anymore.</p>
                <p className="mt-4">It gets worse in peak periods. A sparky in storm season, a plumber after a cold snap, an HVAC crew in the first 40-degree week of summer, all see call volume spike right when they're already flat out on existing jobs. That's exactly when the phone rings the most and gets answered the least, which means the missed-call problem is worst precisely when the jobs on offer are biggest.</p>
                <p className="mt-4">There's also a quieter cost that never makes it onto a spreadsheet: reputation. A caller who rings three tradies and only gets through to one doesn't just book that one job with the tradie who answered, they tell their neighbour, their landlord, their property manager about "the plumber who actually picked up". Missing calls doesn't just cost the job in front of you, it costs the referrals that job would have generated.</p>

                <h2>Why this hits solo operators hardest</h2>
                <p>A two-person office might have someone on the desk. A solo tradie or a two-or-three-person crew doesn't have that luxury, the person doing the work is the same person who'd need to answer the phone. Hiring a receptionist to sit by a phone that only rings a dozen times a day rarely stacks up financially for a small operator, which is exactly the gap human answering services and, more recently, AI receptionists exist to fill.</p>

                <h2>The annual loss, worked out in AUD</h2>
                <p>Take a mid-range plumber missing 5 calls a week, and say half of those would have converted into a job at an average $260 callout:</p>
                <div className="bg-surface-50 border-2 border-black p-6 my-6">
                    <p className="m-0">5 missed calls/week × 50% conversion × $260 average job × 48 working weeks</p>
                    <p className="mt-2 mb-0 font-bold">= roughly $31,200 a year, from one tradie's mobile alone.</p>
                </div>
                <p>Run the same math for an electrician on $220/hr average jobs or an HVAC crew in the thick of a Queensland summer and the number gets bigger, not smaller. This is the quiet leak in a trade business: nothing shows up on an invoice for a job that never got booked.</p>

                <h2>What answering services charge to fix it</h2>
                <p>The obvious fix is a human answering the phone, and Australia already has that option, it just isn't cheap. Human call-answering services for tradies typically run somewhere between $135 and $500+ a month, and you're often paying for a receptionist reading from a script who still has to text you the details and hope you get back to the customer before someone else does. It solves "the phone got answered", it doesn't solve "the job got booked and the invoice got paid".</p>
                <p className="mt-4">There's also a mismatch in what these services are built for. A lot of human answering services were designed for offices and clinics, businesses that book appointments in a fixed calendar and don't need to describe a job, quote a rough price range, or handle an urgent after-hours callout. Trade work is messier than that, and a receptionist working off a generic script often can't answer the specific questions a caller has about your availability or pricing without pinging you anyway.</p>

                <h2>Why an AI receptionist is different</h2>
                <p>Flynn answers the call itself, with a natural Australian voice, and has an actual conversation with the caller rather than reading a script or sending them to a "press 1" menu. It asks what the job is, offers a time, and books it, then texts the caller a confirmation. You don't need to be near your phone, and the caller never feels like they hit voicemail.</p>
                <p className="mt-4">The part most missed-call tools skip entirely is what happens after the booking. Flynn also runs the money side of the job: it puts together the invoice with the job photos on it, sends the pay link, and chases it automatically until it's actually paid. A booked job that never gets invoiced is still a leak, Flynn closes that loop too.</p>

                <SmartStoreCTA
                    headline="Stop losing jobs to a ringing phone"
                    body="Flynn answers when you're on the tools, sounds like a real person, books the job, then invoices it and chases the payment. Free to start."
                />

                <h2>Setting it up</h2>
                <p>Getting calls to Flynn takes one setting on your phone plan, a conditional call-forward so unanswered calls divert to your Flynn number instead of your own voicemail. We've written the exact steps for the two biggest AU carriers: <Link to="/blog/call-forwarding-telstra-missed-call-sms">Telstra call forwarding</Link> and <Link to="/blog/call-forwarding-optus-missed-call-sms">Optus call forwarding</Link>. Both take about two minutes.</p>
                <p className="mt-4">There's nothing to buy hardware-wise and no new number to hand out to customers, your existing business number keeps working exactly as it does now. The only change is what happens on the calls you weren't going to answer anyway. That's the whole appeal for a solo tradie or small crew: you keep doing the job in front of you, and the phone gets covered without pulling you off the tools.</p>
                <p className="mt-4">If you want the trade-specific detail, we've also written full guides for <Link to="/blog/ai-receptionist-for-plumbers-australia">plumbers</Link> and <Link to="/blog/ai-receptionist-for-electricians-australia">electricians</Link>. And if you're still deciding between letting a call ring out, a text-back app, or an AI receptionist that actually answers, see the honest breakdown in <Link to="/blog/missed-call-text-back-vs-voicemail">missed call text back vs voicemail vs AI receptionist</Link>.</p>

                <p className="mt-4">The other half of this problem is what happens once a job is done. Chasing payment is its own leak, see <Link to="/blog/chase-unpaid-invoices-without-awkward-calls">how to chase unpaid invoices without the awkward calls</Link> and <Link to="/blog/late-payment-reminder-templates">late payment reminder templates</Link> for the fix on that end.</p>
            </>
        ),
        faqs: [
            {
                q: "How much money do Australian tradies actually lose to missed calls?",
                a: "It depends on the trade and job value, but a tradie missing even 3 to 5 calls a week can be looking at tens of thousands of dollars a year in unbooked jobs. A plumber on a $260 average callout missing five calls a week at a 50% conversion rate loses roughly $31,000 a year, and electricians and HVAC crews on higher job values lose more."
            },
            {
                q: "Why doesn't voicemail solve this?",
                a: "Most callers looking for a tradie won't leave a voicemail. They hang up and call the next business in the search results instead. Voicemail relies on a habit most people don't have anymore, so it quietly loses jobs without ever showing up as a problem."
            },
            {
                q: "What do human answering services cost in Australia?",
                a: "Human call-answering services for tradies typically run from about $135 up to $500 or more a month. They solve the phone getting answered, but you still have to get the message, call the customer back, book the job yourself, and separately invoice and chase payment."
            },
            {
                q: "How is Flynn different from a human answering service or a text-back app?",
                a: "Flynn actually answers the call with a natural Australian voice and has a real conversation with the caller, books the job on the spot, and texts a confirmation. After the call it also handles the invoice with job photos, the payment link, and automatic chasing until it's paid, which neither a human answering service nor a simple text-back app does."
            },
            {
                q: "How do I get missed calls routed to Flynn?",
                a: "You set up conditional call forwarding on your mobile so calls you don't answer divert to your Flynn number instead of your carrier's voicemail. It's a short carrier code you dial once, see our Telstra and Optus guides for the exact steps."
            }
        ]
    },

    // ─── call-forwarding-telstra-missed-call-sms ───────────────────────────────
    "call-forwarding-telstra-missed-call-sms": {
        title: "How to Set Up Call Forwarding on Telstra (Never Miss a Lead)",
        date: "Jul 23, 2026",
        datePublished: "2026-07-23",
        readTime: "5 min read",
        category: "How-To",
        description: "The exact Telstra codes to forward unanswered calls to your Flynn number, so a missed call gets answered by a real-sounding AI receptionist instead of voicemail.",
        content: (
            <>
                <p className="text-xl text-gray-700 leading-relaxed mb-6">
                    Call forwarding is the whole trick behind never missing a lead on Telstra, you divert calls you don't answer to a number that actually picks up. Here are the exact codes, what to dial, and what the caller hears once it's live.
                </p>

                <Hero pose="point" />

                <h2>Why forwarding matters more than any app</h2>
                <p>An app on your phone can't help if your phone is in the ute, on silent, or your hands are covered in grease. Call forwarding works at the network level, Telstra reroutes the call before it even finishes ringing on your handset. Point it at your Flynn number and every call you'd normally miss gets answered by Flynn instead of going to voicemail.</p>
                <p className="mt-4">This is also why forwarding beats any missed-call app that lives on your phone. Those apps only fire once the call has already gone to voicemail and your handset has registered a missed call, which means the caller has already sat through your voicemail greeting and possibly hung up before anything happens. Network-level forwarding intercepts the call before that greeting ever plays, so the caller experience is a normal ringing phone that gets answered, not a diversion to an answering machine.</p>

                <h2>The Telstra codes</h2>
                <p>Dial these from the phone you want to forward, exactly as written, replacing <code>[number]</code> with the full number including area code:</p>
                <div className="overflow-x-auto my-8">
                    <table className="w-full border-2 border-black">
                        <thead className="bg-black text-white">
                            <tr>
                                <th className="p-4 text-left font-display">What it does</th>
                                <th className="p-4 text-left font-display">Code to dial</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white">
                            <tr className="border-b-2 border-black">
                                <td className="p-4 font-bold">Forward all calls</td>
                                <td className="p-4">*21*[number]#</td>
                            </tr>
                            <tr className="border-b-2 border-black">
                                <td className="p-4 font-bold">Forward when busy</td>
                                <td className="p-4">*67*[number]#</td>
                            </tr>
                            <tr className="border-b-2 border-black">
                                <td className="p-4 font-bold">Forward when unanswered (the tradie default)</td>
                                <td className="p-4">*61*[number]#</td>
                            </tr>
                            <tr className="border-b-2 border-black">
                                <td className="p-4 font-bold">Forward when unreachable (no signal, phone off)</td>
                                <td className="p-4">*62*[number]#</td>
                            </tr>
                            <tr>
                                <td className="p-4 font-bold">Cancel all forwarding</td>
                                <td className="p-4">##002#</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <p>For most tradies, forward when unanswered (<code>*61*</code>) is the one that matters. It leaves your phone ringing as normal for a few seconds, so you can still grab it if you're free, and only sends the call to Flynn once it's clear you're not picking up.</p>

                <h2>Step by step</h2>
                <ol className="list-decimal pl-6 space-y-2">
                    <li>Open the phone app on your mobile.</li>
                    <li>Dial <code>*61*</code> followed by your Flynn number, then <code>#</code>, and hit call.</li>
                    <li>You'll get a confirmation tone or SMS from Telstra saying forwarding is on.</li>
                    <li>Test it: get someone to call your mobile and let it ring out. It should land with Flynn.</li>
                </ol>

                <h2>What the caller hears</h2>
                <p>Instead of your voicemail greeting, the caller gets Flynn picking up in a natural Australian voice. Flynn asks what the job is, checks your availability, and books a time, then texts the caller a confirmation. No "press 1 for bookings", no dead air, just a normal conversation that ends with the job on your calendar.</p>
                <p className="mt-4">Because it sounds like a real person on the other end, callers tend to stay on the line and actually give the details, rather than hanging up the way they would on a voicemail beep. That matters most for the calls you can least afford to lose, a burst pipe at 6pm, no power in a rental, an urgent job with a customer who's already anxious and won't wait around for a callback.</p>

                <h2>Testing it properly</h2>
                <p>Once you've dialled the code, don't just trust the confirmation tone. Get a mate to call your business number and deliberately not have you answer, either put your phone on silent or let it ring past the point you'd normally grab it. Confirm the call actually connects to Flynn, that Flynn answers cleanly, and that you get a text with the booking details afterwards. It's a two-minute test that saves you finding out it wasn't working the day a real job called.</p>

                <SmartStoreCTA
                    headline="Get calls forwarded to Flynn in two minutes"
                    body="Once your Telstra forwarding is set, every call you miss gets answered, booked, and invoiced automatically. Free to start."
                />

                <h2>A 2-minute example</h2>
                <p>A plumber in Penrith sets up <code>*61*</code> forwarding to Flynn between jobs. That afternoon he's got his arm in a wall cavity when a burst-pipe call comes in. It rings out, Flynn answers, gets the address and the problem, and books him in for 4pm. He gets a text with the job details before he's even finished the current call out. No missed job, no callback needed.</p>

                <p className="mt-4">On a different network? See our matching guide for <Link to="/blog/call-forwarding-optus-missed-call-sms">Optus call forwarding codes</Link>. For the bigger picture on what this is actually worth, read <Link to="/blog/missed-calls-cost-australian-tradies">the real cost of missed calls for Australian tradies</Link>, and if you're a plumber or electrician specifically, see our full guides for <Link to="/blog/ai-receptionist-for-plumbers-australia">plumbers</Link> and <Link to="/blog/ai-receptionist-for-electricians-australia">electricians</Link>.</p>
            </>
        ),
        faqs: [
            {
                q: "Which Telstra forwarding code should a tradie use?",
                a: "Forward when unanswered, *61*[number]#, is the right default. It lets your own phone ring first and only forwards the call to Flynn once it's clear you haven't picked up, so you don't miss calls you were actually free for."
            },
            {
                q: "Does call forwarding cost extra on Telstra?",
                a: "Telstra doesn't charge to set up conditional forwarding, but the forwarded call is generally billed as a normal outgoing call from your line, check your specific plan if you're unsure. For most tradies the cost is negligible next to the jobs it recovers."
            },
            {
                q: "How do I turn call forwarding off?",
                a: "Dial ##002# and hit call. That cancels all active call forwarding on the line, regardless of which type you had set up."
            },
            {
                q: "What does the caller hear once forwarding is set up?",
                a: "They hear Flynn answer in a natural Australian voice, not a script or a menu. Flynn asks about the job, offers a time, books it, and texts a confirmation, so the call feels like talking to a real person rather than reaching voicemail."
            }
        ]
    },

    // ─── call-forwarding-optus-missed-call-sms ─────────────────────────────────
    "call-forwarding-optus-missed-call-sms": {
        title: "How to Set Up Call Forwarding on Optus (Step-by-Step)",
        date: "Jul 24, 2026",
        datePublished: "2026-07-24",
        readTime: "5 min read",
        category: "How-To",
        description: "The exact Optus codes to divert unanswered calls to your Flynn number, plus postpaid vs prepaid notes, so missed calls get answered instead of going to voicemail.",
        content: (
            <>
                <p className="text-xl text-gray-700 leading-relaxed mb-6">
                    If you're on Optus, forwarding unanswered calls to Flynn takes one code dialled from your handset. Here's exactly what to dial, how it differs from Telstra, and what to check if you're on a prepaid plan.
                </p>

                <Hero pose="point" />

                <h2>The Optus codes</h2>
                <div className="overflow-x-auto my-8">
                    <table className="w-full border-2 border-black">
                        <thead className="bg-black text-white">
                            <tr>
                                <th className="p-4 text-left font-display">What it does</th>
                                <th className="p-4 text-left font-display">Code to dial</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white">
                            <tr className="border-b-2 border-black">
                                <td className="p-4 font-bold">Forward when not answered (20-second ring)</td>
                                <td className="p-4">**61*[number]*11*20#</td>
                            </tr>
                            <tr className="border-b-2 border-black">
                                <td className="p-4 font-bold">Forward when busy</td>
                                <td className="p-4">**67*[number]#</td>
                            </tr>
                            <tr className="border-b-2 border-black">
                                <td className="p-4 font-bold">Forward all calls</td>
                                <td className="p-4">**21*[number]#</td>
                            </tr>
                            <tr>
                                <td className="p-4 font-bold">Cancel all forwarding</td>
                                <td className="p-4">##002#</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <p>The no-answer code is the one worth setting up. It rings your phone for 20 seconds first, plenty of time to answer if your hands are free, then forwards to Flynn if you don't pick up. Swap the <code>20</code> for a different second count if you want it to ring longer before diverting.</p>

                <h2>Step by step</h2>
                <ol className="list-decimal pl-6 space-y-2">
                    <li>Open your phone's dial pad.</li>
                    <li>Enter <code>**61*</code>, then your Flynn number, then <code>*11*20#</code>, and hit call.</li>
                    <li>Optus will confirm forwarding is active, usually with a short tone or a follow-up SMS.</li>
                    <li>Ring your own mobile from another phone and let it go unanswered to confirm it lands with Flynn.</li>
                </ol>

                <h2>Postpaid vs prepaid</h2>
                <p>Conditional call forwarding works the same way on both, but prepaid users should check they've got enough credit before relying on it. On some prepaid plans a forwarded call can draw down your balance the same as an outgoing call, so it pays to have auto-recharge on or a bit of credit sitting there if forwarding is running all day.</p>
                <p className="mt-4">Postpaid business plans generally don't need any of this thought, forwarding just runs as part of the plan without eating into a balance. If you're not sure which you're on, check your last Optus bill or app, plans billed monthly with no top-ups are postpaid, plans you recharge manually or on auto-recharge are prepaid.</p>
                <p className="mt-4">One more thing worth checking on both plan types: make sure call forwarding isn't blocked by any spend limit or account restriction, which occasionally happens on business SIMs with strict caps. If the code doesn't confirm forwarding is active, that's usually the reason, and a quick call to Optus support clears it.</p>

                <h2>What happens once it's set up</h2>
                <p>Any call you don't answer within the ring window goes straight to Flynn, who picks up with a natural Australian voice and has a real conversation rather than pointing the caller to a menu. Flynn finds out what the job is, offers you a time, books it, and texts the caller a confirmation. Once the job's done, Flynn also handles the invoice with job photos, sends the pay link, and chases it until it clears, so the loop doesn't stop at "booked".</p>
                <p className="mt-4">You keep your existing Optus number, your customers don't need to save a new contact, and there's nothing extra to carry to a job site. The forwarding sits quietly in the background and only ever kicks in on calls you weren't going to catch anyway, so there's no downside to leaving it running all the time, not just during busy periods.</p>

                <h2>A quick example</h2>
                <p>A cleaner on Optus prepaid sets up the no-answer forward before starting a job in a client's house, where she can't hear her phone over the vacuum. A new enquiry rings through mid-clean, rings for 20 seconds, then forwards to Flynn, who books a quote for Thursday and texts the customer a confirmation. She sees the job land in her calendar on her break, no missed call notification, no callback needed.</p>

                <SmartStoreCTA
                    headline="Route your Optus missed calls to Flynn"
                    body="Set the forward once and every unanswered call gets picked up, booked, and invoiced without you touching your phone. Free to start."
                />

                <p className="mt-4">On Telstra instead? Here's the sister guide with the equivalent <Link to="/blog/call-forwarding-telstra-missed-call-sms">Telstra call forwarding codes</Link>. For the numbers behind why this matters, see <Link to="/blog/missed-calls-cost-australian-tradies">the real cost of missed calls for Australian tradies</Link>, and trade-specific setups for <Link to="/blog/ai-receptionist-for-plumbers-australia">plumbers</Link> and <Link to="/blog/ai-receptionist-for-electricians-australia">electricians</Link>.</p>
            </>
        ),
        faqs: [
            {
                q: "What's the best Optus code for a tradie to use?",
                a: "**61*[number]*11*20# is the one to use. It forwards calls you don't answer within 20 seconds to your Flynn number, giving you a fair chance to pick up if you're free without losing calls when you're not."
            },
            {
                q: "Does call forwarding work differently on Optus prepaid?",
                a: "The forwarding codes themselves work the same way, but prepaid users should keep enough credit on the account since a forwarded call can be billed like a normal outgoing call. Postpaid users don't need to worry about this."
            },
            {
                q: "Can I change how long it rings before forwarding?",
                a: "Yes, change the number at the end of the code, for example *11*15# rings for 15 seconds before forwarding instead of 20. Shorter is better if you know you're rarely free to answer."
            },
            {
                q: "How do I cancel Optus call forwarding?",
                a: "Dial ##002# and call. That switches off any active forwarding, whether it was set for no-answer, busy, or all calls."
            }
        ]
    },

    // ─── missed-call-text-back-vs-voicemail ────────────────────────────────────
    "missed-call-text-back-vs-voicemail": {
        title: "Text Back vs Voicemail vs AI Receptionist: What Wins Jobs?",
        date: "Jul 25, 2026",
        datePublished: "2026-07-25",
        readTime: "8 min read",
        category: "Comparison",
        description: "Voicemail, auto text-back apps, and an AI receptionist that answers calls, compared honestly on what actually turns a missed call into a booked job.",
        content: (
            <>
                <p className="text-xl text-gray-700 leading-relaxed mb-6">
                    When you can't get to the phone, you've got three real options: let it go to voicemail, let an app fire off an automatic text, or have something actually answer and talk to the caller. Only one of those reliably turns into a booked job, here's the honest comparison.
                </p>

                <Hero pose="wave" />

                <h2>Option 1: Voicemail</h2>
                <p>Voicemail is what everyone starts with because it's already there, free, and needs no setup. The problem is behavioural, not technical. Industry studies consistently put the share of callers who actually leave a voicemail at a small minority, most people just hang up and ring the next business. If you're relying on voicemail to catch missed calls, you're relying on a habit most callers don't have anymore.</p>
                <p className="mt-4">Even when someone does leave a message, you still have to notice it, listen to it, and call them back before they've booked with someone else. That's minutes or hours of lag on a lead who wanted an answer right now.</p>
                <p className="mt-4">There's also the tone problem. A generic voicemail greeting, "you've reached [business], leave a message", doesn't reassure an anxious caller with water coming through their ceiling that anyone is coming. It sounds like every other small business voicemail they've already hung up on that afternoon.</p>

                <h2>Option 2: Auto text-back apps</h2>
                <p>These are a real step up. The moment you miss a call, the caller gets an automatic text, usually something like "sorry I missed your call, here's a link to book". It's faster than voicemail and doesn't rely on the caller doing anything except reading a text. But a link isn't a conversation. The caller still has to tap through, work out what to fill in, and hope it's actually clear what happens next. For an urgent job like a burst pipe or no power, a lot of people would rather just talk to someone, and if your text-back doesn't feel like that, they'll ring the next name on the list while your link sits unread.</p>
                <p className="mt-4">Text-back apps also don't do anything with the job once it's booked. The invoicing, the payment chasing, all of that is still on you.</p>
                <p className="mt-4">There's a smaller but real friction cost too, not every caller taps a link straight away. Some read it and mean to come back to it later, and later they've already booked someone else. A text you have to act on is always going to convert worse than a conversation that ends with the job already locked in.</p>

                <h2>Option 3: An AI receptionist that actually answers</h2>
                <p>This is the option most people don't realise exists yet in Australia. Instead of the call going to voicemail or triggering a text, it gets answered, by Flynn, in a natural Australian voice, having an actual conversation. The caller never feels like they've hit a machine or a missed call at all, they just get someone asking what the job is, offering a time, and booking it in. A confirmation text goes out straight after.</p>
                <p className="mt-4">Because the call is answered rather than diverted to a message, this is the only one of the three that captures urgent, emotionally-driven calls, the ones where someone's water is coming through the ceiling and they want a human voice, not a link to tap.</p>

                <h2>Side by side</h2>
                <div className="overflow-x-auto my-8">
                    <table className="w-full border-2 border-black">
                        <thead className="bg-black text-white">
                            <tr>
                                <th className="p-4 text-left font-display">Method</th>
                                <th className="p-4 text-left font-display">What the caller experiences</th>
                                <th className="p-4 text-left font-display">Books the job?</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white">
                            <tr className="border-b-2 border-black">
                                <td className="p-4 font-bold">Voicemail</td>
                                <td className="p-4">Leaves a message or, more likely, hangs up</td>
                                <td className="p-4">No, needs a manual callback</td>
                            </tr>
                            <tr className="border-b-2 border-black">
                                <td className="p-4 font-bold">Auto text-back</td>
                                <td className="p-4">Gets a text with a link to tap through</td>
                                <td className="p-4">Sometimes, if they follow the link</td>
                            </tr>
                            <tr>
                                <td className="p-4 font-bold">AI receptionist (Flynn)</td>
                                <td className="p-4">Talks to someone, gets a time, gets a text confirmation</td>
                                <td className="p-4">Yes, on the call itself</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <h2>What happens after the booking matters too</h2>
                <p>None of the DIY methods do anything once a job is on the calendar. Flynn does. After the job's done, it drafts the invoice with the job photos attached, sends the payment link, and keeps chasing until it's actually paid, the same money loop covered in <Link to="/blog/chase-unpaid-invoices-without-awkward-calls">chasing unpaid invoices without the awkward calls</Link> and <Link to="/blog/late-payment-reminder-templates">late payment reminder templates</Link>.</p>
                <p className="mt-4">That's worth sitting with for a second, because it changes the comparison. Voicemail and text-back apps solve, at best, "did the phone get answered". Neither touches what happens after the job, so you're still manually invoicing, still manually following up on late payers, still doing the admin by hand even on the calls that did convert. An AI receptionist that also runs the invoicing and chasing closes a second gap most tradies don't even think of as related to their missed-call problem, but it's the same admin overload that keeps you from answering the phone properly in the first place.</p>

                <h2>What each option actually costs</h2>
                <p>Voicemail is free, and that's exactly the problem, it's free because nothing is actually working to win you the job. Text-back apps usually sit in the tens of dollars a month range and only handle the SMS side. Human answering services, the traditional Australian fix, run from roughly $135 up to $500 or more a month for a person reading a script who still has to relay the message to you. Flynn is free to start, answers the call itself instead of relaying a message, and earns from the invoicing and payment side of the job rather than charging a seat fee for the phone-answering part.</p>

                <h2>The setup effort compared</h2>
                <p>Voicemail needs nothing, which is its only real advantage. Text-back apps need an app install and some setup time to write your message and connect a number. An AI receptionist needs one carrier forwarding code, dialled once, covered in our <Link to="/blog/call-forwarding-telstra-missed-call-sms">Telstra</Link> and <Link to="/blog/call-forwarding-optus-missed-call-sms">Optus</Link> guides, and you're done. None of the three options require you to change your business number or tell customers anything different.</p>

                <SmartStoreCTA
                    headline="Let calls get answered, not missed"
                    body="Flynn talks to the caller, books the job, then invoices it and chases the payment. No link to tap, no voicemail to check. Free to start."
                />

                <h2>When voicemail is still fine</h2>
                <p>If you genuinely get one or two calls a month and don't rely on the phone for new business, voicemail's not going to sink you. But for any trade where the phone is the main way new jobs come in, the gap between voicemail and an actual answer is the gap between a booked job and a job that went to someone else.</p>

                <p className="mt-4">For the numbers on what missed calls actually cost, read <Link to="/blog/missed-calls-cost-australian-tradies">the real cost of missed calls for Australian tradies</Link>. To get calls routed to Flynn, see the carrier guides for <Link to="/blog/call-forwarding-telstra-missed-call-sms">Telstra</Link> and <Link to="/blog/call-forwarding-optus-missed-call-sms">Optus</Link>, and check out our best-of roundup, <Link to="/blog/best-ai-assistant-for-tradies-2026">the best AI assistant for tradies in 2026</Link>.</p>
            </>
        ),
        faqs: [
            {
                q: "Is voicemail really that bad for a trade business?",
                a: "Industry studies consistently put the share of callers who bother leaving a voicemail at a small minority, most just hang up and call the next business. If new work mostly comes in by phone, voicemail alone quietly loses you jobs without ever showing up as a complaint."
            },
            {
                q: "Aren't auto text-back apps good enough?",
                a: "They're better than voicemail but still ask the caller to do work, tap a link, read instructions, fill something in. For urgent jobs a lot of callers would rather talk to a person straight away, and text-back apps also don't touch invoicing or payment once the job's booked."
            },
            {
                q: "What makes an AI receptionist different from a text-back app?",
                a: "Flynn actually answers the call and has a real conversation in a natural Australian voice, so the caller never feels like they missed you at all. It books the job on the call itself and texts a confirmation, then invoices the job with photos and chases payment afterwards."
            },
            {
                q: "Does an AI receptionist replace an answering service?",
                a: "For most trades, yes, and at a fraction of what human answering services charge in Australia. It answers every call the same way, at any hour, and unlike a human service it also handles the invoicing and payment chasing once the job's done."
            }
        ]
    }
};

export default receptionistPostsA;
