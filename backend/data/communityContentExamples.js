const recyclingPosts = [
  {
    title: 'Start with Clean, Dry Recyclables',
    summary: 'A quick rinse helps paper, cans, and containers stay recyclable.',
    body: 'Empty containers and remove leftover food before setting recyclables aside. Let them dry, then keep them separate from wet waste. Local collection rules can vary, so follow the guidance from your barangay.'
  },
  {
    title: 'Know What the Recycling Symbol Means',
    summary: 'The number inside a recycling symbol identifies a plastic resin, not a promise of local acceptance.',
    body: 'A triangle with a number helps identify the type of plastic. It does not guarantee that every recycling program accepts that item. Check with your local collection point before placing unfamiliar plastics in a recycling bin.'
  },
  {
    title: 'Give Cardboard a Second Life',
    summary: 'Flatten clean boxes to make storage and collection easier.',
    body: 'Remove tape and packing materials when practical, keep cardboard dry, and flatten boxes before storing them. Greasy or food-soiled cardboard may not be accepted with clean paper, so keep it separate.'
  },
  {
    title: 'Recycle Aluminum Cans the Right Way',
    summary: 'Empty cans and keep them apart from food waste.',
    body: 'Pour out the remaining drink, give the can a quick rinse if needed, and allow it to drain. Store cans in a clean, dry container. Do not place sharp or hazardous items inside cans.'
  },
  {
    title: 'Keep Glass Separate and Safe',
    summary: 'Glass acceptance differs by collection program.',
    body: 'Ask your barangay or recycling point whether it accepts glass and how it should be sorted. Never put broken glass loose in a bag; wrap and label it securely so residents and collection workers are protected.'
  },
  {
    title: 'Remove Food from Recyclable Containers',
    summary: 'A small cleanup prevents residue from contaminating other materials.',
    body: 'Scrape out leftover food and empty liquids from jars, cans, and tubs. A full wash is usually unnecessary, but containers should not be dripping or full of food when stored for recycling.'
  },
  {
    title: 'Reuse Before You Recycle',
    summary: 'Reusable containers can avoid waste before it is created.',
    body: 'When safe and practical, reuse sturdy jars, boxes, and containers for storage. Choose refillable items where available. Reuse is not suitable for every material, especially containers that held chemicals or hazardous products.'
  },
  {
    title: 'Keep Paper Clean and Dry',
    summary: 'Wet or food-contaminated paper can be difficult to recover.',
    body: 'Store newspapers, office paper, and clean cardboard away from rain and food scraps. Keep tissue, napkins, and heavily soiled paper separate unless your local program specifically accepts them.'
  },
  {
    title: 'Separate Batteries from Household Waste',
    summary: 'Batteries need safe handling and special collection.',
    body: 'Do not put batteries in recycling bins or ordinary trash unless local guidance specifically says it is safe. Keep them dry and away from heat, and bring them to an approved battery or hazardous-waste collection point.'
  },
  {
    title: 'Make a Simple Home Sorting Station',
    summary: 'A few labeled containers make sorting easier for everyone.',
    body: 'Set up separate, clearly labeled containers for recyclables, food scraps, residual waste, and special waste. Place the station somewhere convenient and post your barangay collection instructions nearby.'
  }
];

const tipPosts = [
  {
    title: 'Tie Waste Bags Securely',
    summary: 'Closed bags help keep waste contained during handling.',
    body: 'Use a sturdy bag and tie it securely before collection. Avoid overfilling bags, which can split when lifted. Keep sharp objects and hazardous materials separate and clearly identified.'
  },
  {
    title: 'Drain Liquids Before Disposal',
    summary: 'Less liquid means fewer leaks and lighter bags.',
    body: 'Pour leftover liquids into an appropriate drain or container before throwing away packaging. Never pour oils, fuel, paint, or chemicals into storm drains; follow local hazardous-waste guidance.'
  },
  {
    title: 'Keep Collection Areas Clear',
    summary: 'Leave safe access for pedestrians and collection crews.',
    body: 'Place waste only at the approved collection point and keep sidewalks, driveways, and drainage paths clear. Follow your barangay schedule rather than leaving bags out for long periods.'
  },
  {
    title: 'Protect Waste from Rain',
    summary: 'Covered storage helps prevent litter and runoff.',
    body: 'Store tied waste bags in a covered, secure place until collection. Do not leave loose waste where rain or wind can carry it into streets, waterways, or drains.'
  },
  {
    title: 'Handle Broken Glass Carefully',
    summary: 'Warn others before they handle the package.',
    body: 'Wrap broken glass in thick paper or cardboard, place it in a rigid container, and label it clearly. Keep it away from children and never mix loose shards into an unmarked waste bag.'
  },
  {
    title: 'Keep Drains Free of Litter',
    summary: 'Small pieces of litter can block water flow.',
    body: 'Use a bin for wrappers and other small waste instead of placing them near a drain. If a drain is blocked or unsafe to approach, report its location to the proper local office rather than entering the water.'
  },
  {
    title: 'Flatten Boxes Before Collection',
    summary: 'Flat cardboard takes up less storage space.',
    body: 'Remove loose packing, flatten clean cardboard, and secure it in a neat bundle. Keep it dry and separate from food waste so it can be handled more easily.'
  },
  {
    title: 'Use Refillable Water Bottles',
    summary: 'A reusable bottle can reduce single-use packaging.',
    body: 'Carry a clean, refillable bottle when practical. Wash it regularly and use safe drinking-water sources. Reuse is an easy way to avoid creating disposable bottle waste.'
  },
  {
    title: 'Keep E-Waste Out of Regular Bins',
    summary: 'Small electronics can contain materials that need special handling.',
    body: 'Do not place phones, chargers, bulbs, or other electronic waste in ordinary bins. Store them safely and check with your local government for an approved e-waste collection option.'
  },
  {
    title: 'Report a Waste Concern with Clear Details',
    summary: 'A precise location helps staff understand where to respond.',
    body: 'When submitting a report, select the correct barangay and include a nearby landmark, a short description, and a photo when safe. Do not enter private property or put yourself at risk to take evidence.'
  }
];

const blogPosts = [
  {
    title: 'Why Sorting Waste at Home Matters',
    summary: 'Good sorting starts with a few simple habits.',
    body: 'Separating recyclables, food scraps, residual waste, and special waste at home makes materials easier to handle. Start with a small set of labeled containers and teach everyone what belongs in each one. Check local guidance regularly because accepted materials can differ between collection programs.'
  },
  {
    title: 'A Cleaner Street Starts at the Curb',
    summary: 'Thoughtful set-out habits help keep shared spaces tidy.',
    body: 'Use designated collection points, secure bags, and keep waste away from drains and walkways. Put materials out according to the schedule provided by your barangay. These small steps can reduce litter and make collection safer for residents and crews.'
  },
  {
    title: 'Reducing Single-Use Packaging',
    summary: 'Reusable choices can prevent waste before it reaches the bin.',
    body: 'Bring reusable bags and containers when practical, choose refillable products where available, and avoid unnecessary packaging. Reuse items only when they are clean and safe for their intended purpose, then sort them according to local rules when they can no longer be reused.'
  },
  {
    title: 'What Happens After Collection?',
    summary: 'Proper sorting makes the next steps easier to manage.',
    body: 'Collected materials may be transported, sorted, recovered, treated, or disposed of depending on their type and local facilities. Keeping recyclables clean and keeping hazardous materials separate helps workers handle each stream more safely.'
  },
  {
    title: 'Food Scraps and Responsible Composting',
    summary: 'Some organic material can be returned to the soil.',
    body: 'Fruit and vegetable scraps, leaves, and other suitable organics can be composted where a safe, well-managed composting option exists. Avoid adding meat, oils, and other materials unless your method accepts them. If composting is not available, follow your local collection instructions.'
  },
  {
    title: 'Keeping Rivers and Drains Free of Plastic',
    summary: 'Prevent litter from reaching waterways.',
    body: 'Lightweight wrappers can travel far once they enter a gutter or drain. Store small waste until you find a bin, secure bags before collection, and report recurring dumping locations. Never enter fast-moving or contaminated water to retrieve litter.'
  },
  {
    title: 'Safer Handling for Household Batteries',
    summary: 'Special waste should not be mixed into ordinary household bags.',
    body: 'Batteries can leak or cause fires if damaged or handled incorrectly. Keep them away from heat and moisture, cover exposed terminals when appropriate, and use a local collection program. Follow manufacturer or local government safety instructions.'
  },
  {
    title: 'Making Community Cleanups More Effective',
    summary: 'Planning and safe handling matter as much as turnout.',
    body: 'A cleanup works best when participants know the area, roles, and waste-handling plan in advance. Provide gloves and suitable tools, separate recyclables where possible, and arrange an approved collection point. Volunteers should avoid hazardous waste and unsafe locations.'
  },
  {
    title: 'How to Make a Useful Waste Report',
    summary: 'Accurate details help responders assess a concern.',
    body: 'Choose the correct barangay, describe what was observed, and add a nearby landmark or safe-to-take photo. Avoid sharing personal information about other residents. If the issue poses an immediate danger, contact the appropriate emergency service.'
  },
  {
    title: 'Small Daily Habits for a Cleaner Neighborhood',
    summary: 'Consistent actions add up across a community.',
    body: 'Carry a reusable bag, sort waste correctly, keep public paths clear, and follow collection schedules. Talk with household members about local rules and share verified information. A cleaner neighborhood grows from practical habits repeated every day.'
  }
];

const eventPosts = [
  {
    title: 'DEMO ONLY — Community Cleanup Morning',
    summary: 'Example event listing for app testing; this is not a real scheduled event.',
    body: 'DEMO ONLY. This sample post shows residents how a community cleanup announcement may appear. The date and sample location are fictional and must not be treated as an official CityCare or barangay activity.',
    eventStartAt: '2027-01-09T08:00:00.000Z',
    eventEndAt: '2027-01-09T11:00:00.000Z'
  },
  {
    title: 'DEMO ONLY — Household Waste-Sorting Workshop',
    summary: 'Example event listing for app testing; this is not a real scheduled event.',
    body: 'DEMO ONLY. Sample workshop announcement demonstrating an event card. No workshop has been confirmed; verify all details with the barangay before planning attendance.',
    eventStartAt: '2027-01-23T09:00:00.000Z',
    eventEndAt: '2027-01-23T11:00:00.000Z'
  },
  {
    title: 'DEMO ONLY — Recycling Drop-Off Day',
    summary: 'Example event listing for app testing; this is not a real scheduled event.',
    body: 'DEMO ONLY. This sample entry demonstrates a recycling drop-off notice. Materials accepted and collection arrangements are fictional examples, not official instructions.',
    eventStartAt: '2027-02-06T08:00:00.000Z',
    eventEndAt: '2027-02-06T12:00:00.000Z'
  },
  {
    title: 'DEMO ONLY — Youth Environmental Learning Session',
    summary: 'Example event listing for app testing; this is not a real scheduled event.',
    body: 'DEMO ONLY. A fictional learning-session listing used to demonstrate event details in the resident app. Please do not travel to the sample location.',
    eventStartAt: '2027-02-20T13:00:00.000Z',
    eventEndAt: '2027-02-20T15:00:00.000Z'
  },
  {
    title: 'DEMO ONLY — Neighborhood Litter-Prevention Walk',
    summary: 'Example event listing for app testing; this is not a real scheduled event.',
    body: 'DEMO ONLY. This fictional listing demonstrates a neighborhood awareness event. It is not an invitation or an approved public activity.',
    eventStartAt: '2027-03-06T07:30:00.000Z',
    eventEndAt: '2027-03-06T09:00:00.000Z'
  },
  {
    title: 'DEMO ONLY — Composting Basics Demonstration',
    summary: 'Example event listing for app testing; this is not a real scheduled event.',
    body: 'DEMO ONLY. Sample content for testing the event calendar. The activity and venue are fictional; no registration or attendance is available.',
    eventStartAt: '2027-03-20T09:00:00.000Z',
    eventEndAt: '2027-03-20T11:00:00.000Z'
  },
  {
    title: 'DEMO ONLY — Safe E-Waste Information Booth',
    summary: 'Example event listing for app testing; this is not a real scheduled event.',
    body: 'DEMO ONLY. Fictional sample event used to test event presentation. This does not confirm an e-waste collection point or accepted materials.',
    eventStartAt: '2027-04-10T08:00:00.000Z',
    eventEndAt: '2027-04-10T12:00:00.000Z'
  },
  {
    title: 'DEMO ONLY — Reusable-Products Community Fair',
    summary: 'Example event listing for app testing; this is not a real scheduled event.',
    body: 'DEMO ONLY. This is a fictional community-fair example, not a real event announcement. Venue and schedule are placeholders for testing only.',
    eventStartAt: '2027-04-24T09:00:00.000Z',
    eventEndAt: '2027-04-24T14:00:00.000Z'
  },
  {
    title: 'DEMO ONLY — Drain and Waterway Awareness Session',
    summary: 'Example event listing for app testing; this is not a real scheduled event.',
    body: 'DEMO ONLY. A fictional awareness-session card included for testing. Do not interpret this post as a confirmed city program or safety instruction.',
    eventStartAt: '2027-05-08T10:00:00.000Z',
    eventEndAt: '2027-05-08T12:00:00.000Z'
  },
  {
    title: 'DEMO ONLY — Community Reuse and Repair Exchange',
    summary: 'Example event listing for app testing; this is not a real scheduled event.',
    body: 'DEMO ONLY. This sample entry illustrates a community exchange event. The activity, date, and venue are fictional and are not officially scheduled.',
    eventStartAt: '2027-05-22T09:00:00.000Z',
    eventEndAt: '2027-05-22T13:00:00.000Z'
  }
].map(event => ({
  ...event,
  type: 'event',
  location: 'DEMO ONLY — fictional sample location; not a real venue'
}));

const contentByType = {
  recycle: recyclingPosts,
  event: eventPosts,
  tip: tipPosts,
  blog: blogPosts
};

const draftPosts = {
  recycle: [
    ['DRAFT — Safe Handling for Household Chemicals', 'Draft guidance on labels, storage, and approved disposal options.'],
    ['DRAFT — Preparing Recyclables for Collection', 'Draft checklist for sorting, cleaning, and storing recyclable materials.'],
    ['DRAFT — Reuse Ideas for Common Containers', 'Draft examples of safe ways to reuse containers before recycling.'],
    ['DRAFT — Understanding Local Recycling Symbols', 'Draft explainer reminding residents to verify local acceptance rules.']
  ],
  event: [
    ['DRAFT — Barangay Recycling Information Session', 'Draft event listing; confirm organizer, date, and venue before publishing.'],
    ['DRAFT — Community Reuse Demonstration', 'Draft event listing; confirm activity details and accessible venue before publishing.'],
    ['DRAFT — Waste-Sorting Orientation', 'Draft event listing; confirm facilitator, schedule, and location before publishing.'],
    ['DRAFT — Neighborhood Cleanup Planning Meeting', 'Draft event listing; confirm barangay approval and meeting details before publishing.']
  ],
  tip: [
    ['DRAFT — Keep Reusable Bags Ready', 'Draft reminder to store reusable bags where they are easy to remember.'],
    ['DRAFT — Label Household Sorting Bins', 'Draft tip on making household sorting stations easier to use.'],
    ['DRAFT — Store Special Waste Separately', 'Draft safety reminder to keep batteries and e-waste out of regular bins.'],
    ['DRAFT — Check Collection Updates', 'Draft reminder to follow current barangay collection announcements.']
  ],
  blog: [
    ['DRAFT — Planning a Safer Community Cleanup', 'Draft article about planning, protective equipment, and safe waste handling.'],
    ['DRAFT — Choosing Reusable Items That Last', 'Draft article on practical reusable products and proper care.'],
    ['DRAFT — Reducing Food Waste at Home', 'Draft article on meal planning and safe storage to reduce discarded food.'],
    ['DRAFT — Building Better Household Sorting Habits', 'Draft article on making waste separation simple and consistent.']
  ]
};

const content = [];
for (const [type, posts] of Object.entries(contentByType)) {
  for (const post of posts) content.push({ type, ...post, status: 'published' });
  for (const [title, body] of draftPosts[type]) {
    content.push({
      type,
      title,
      summary: 'Draft content for administrator review; not visible to residents.',
      body,
      ...(type === 'event' ? {
        eventStartAt: '2028-01-15T09:00:00.000Z',
        eventEndAt: '2028-01-15T11:00:00.000Z',
        location: 'Draft only — confirm venue before publishing'
      } : {}),
      status: 'draft'
    });
  }
}

module.exports = content;
