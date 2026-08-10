Prioritize this request above the existing spec, once implemented you need to update our docs to be aligned with the implementation result, execute based on batch order, no need ask my permission to start a new batch:

Batch 1: DONE — see docs/progress.md row 19 for what shipped.
- ~~Update database schema for Skills, I want to add 'Category', 1 skill = 1 category. 'categories' will have own table, so the field 'category' will take the id for categories field. The 'skill category' will be managed from 'settings' same as the 'tags'.~~
- ~~Block template: add new block structure where it composed like string literal in javacript. For example currently text: "$data.name", I want be able like text: "Hello my name is $data.name and I'm a $data.headline"~~
- ~~Block template: make the item list possible to be merged, with customizable separator and the ended character. For example currently skill list is rendered as ul > li. Make it possible to make it as p > skill text, separated by (,) ended by (.). And this setting will be implemented on the next batch.~~


Batch 3: DONE — see docs/progress.md row 20 for what shipped. (Note: there is no "Batch 2" in this backlog — it jumps 1 → 3 in the original request; confirmed with the user that "go ahead for batch 2" meant "the next one," i.e. this batch.)
- ~~remove field_visibility in personas~~
- ~~field visibility should be part of cv without mutate the personas, so cv will have personas settings and template settings~~
- ~~remove cv-template-blocks.ts, template blocks should be part of template (classic or two-columns). It means the template is self-contained, each has everything required without importing block or styles~~
- ~~in template structure, new property called 'stylesSchema' and 'blocksSchema' (or improve the wording). These schema is to give detailed information about each style and block, the information such as: Title and description. The purpose is to give title and description on data and style tab of each item. This is to solve issue when user select style in cvs/:id/print > tab style, the select label shows the field name which is not human friendly, user also doesn't know what that about.~~
- ~~add block settings in cv settings tabs. This setting is to customize the block, for example to which styles are used, what text value for the bullet, what field need to attached to the block~~


Batch 4: DONE — see docs/progress.md row 21 for what shipped.
- ~~Overall problem: For user with many experiences and skills, the page become too long and splitted to multiple page. Make it more compact and line efficient.~~
- ~~Ensure it ATS/Parser friendly. The main target reader is machine while the human reader become the secondary target.~~
- ~~Contact and socials will be merged text with '|' separator.~~
- ~~work description + responsibilites + highlight will be on same parent <ul>~~
- ~~Skills will use format 'category: skills', example:~~
 ```
    - Languages: JavaScript (ES6+), TypeScript, Python, SQL, HTML5/CSS3
    - Frameworks & Libraries: React, Next.js, Node.js, Express, Tailwind CSS, Jest
    - Databases & APIs: PostgreSQL, MongoDB, GraphQL, RESTful APIs
    - DevOps & Tools: Git, Docker, GitHub Actions, AWS (S3, Lambda), Vercel
 ```

Batch 5: DONE — see docs/progress.md row 24 for what shipped.
- ~~Implement batch action in inventory~~
- ~~In batch action: replace 'add to cv' to 'add to persona', when click it will open popup with persona table with selectable items. If the persona entry only need a single item, then only choose the latest selected. For example we can select multiple skill and add to persona, but for headline we can only add one while the table can check multiple, in this case only add one the latest selected. Only add items that not included yet in the target persona. For example the selected persona has A, B, C, D and the batch action is B,C,E,F, then you only need to add E,F.~~
- ~~In certificate form, we missed the 'link'~~
- ~~In work entry form, the skill used, when the skill not exist, allow user to add directly in 'skilled used' input. So when typing. For example when typing 'Figma' but it doesn't available in the autocomplete list, user can just press enter and it will open the Skill dialog form with 'Figma' prefilled in the title. When saved it will added to the 'skill used'.~~
