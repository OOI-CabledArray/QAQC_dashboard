FROM httpd:2.4
COPY ./www/ /usr/local/apache2/htdocs/
COPY ./QAQCplots /usr/local/apache2/QAQCplots