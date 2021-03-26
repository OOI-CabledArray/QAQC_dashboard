FROM httpd:2.4
COPY ./www/QAQC_dashboard /usr/local/apache2/htdocs/QAQC_dashboard
COPY ./www/index.html /usr/local/apache2/htdocs/index.html
COPY ./www/cgi-bin/ /usr/local/apache2/cgi-bin/
COPY ./www/httpd.conf /usr/local/apache2/conf/httpd.conf
COPY ./QAQCplots /usr/local/apache2/QAQCplots

# Install python
RUN apt update && apt install --yes python3 && ln -s /usr/bin/python3 /usr/bin/python