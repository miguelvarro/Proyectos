CC=gcc
CFLAGS=-O2 -fopenmp

all: omp_pi

omp_pi: omp_pi.c
	$(CC) $(CFLAGS) omp_pi.c -o omp_pi

clean:
	rm -f omp_pi

