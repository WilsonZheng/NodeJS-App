# Nodejs-App: using postgresDB
Simple Console application for CRUD operation using NodeJS, KnexJS and PostgresDB

# Features
1. app.js: Insert, Get,Update, Delete operation to local postgres DB two tables: Book and Author
2. NumAndEmailMasking.js : using Regular Expression to mask the input phone number and email
    Examples
     input:

          0212666624

          212666624

          0064212626624

          +64212626624

          098381574

          abcdefg@gmail.com

          1234567@gmail.com

          abcd456@nsn.com

     output:

          021*****24

          021*****24

          0064*******24

          +6421*****24

          098****74

          a******@gmail.com

          1******@gmail.com

          a******@nsn.com

# To set up environment
1. Download the source code 
2. Use powershell or cmd navigate to the root folder
3. Execute: "npm install" to install the required package
4. Download postgres database and pgAdmin 4
5. Set up two tables in the local db(called testdb):
  
  -Book: 
  id(primary key, bigint) author_id(foreign key, bigint), title(character varying(50)), rate(character varying(50))
  
  -Author:
  id(primary key bigint), firstname(character varying(50)),lastname(character varying(50))
  
6. To run the code: use command "node app.js"


# Note
Command to run the app:

In CMD, navigate to the project folder contains app.js and NumAndEmailMasking.js, run the following command (NodeJS required to be installed):

"node app.js"
or
"node NumAndEmailMasking.js"

Command to push update:
git push origin master
or git push https://github.com/WilsonZheng/postgresDB-App.git HEAD:master

Command to pull update:
git pull origin master
