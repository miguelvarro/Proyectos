#include <stdio.h>
#include <stdlib.h>
#include <omp.h>

/*
  Demo OpenMP: aproximación de PI por integración de 4/(1+x^2) en [0,1]
  Compilar con: gcc -O2 -fopenmp omp_pi.c -o omp_pi
*/

int main() {
    const long long N = 200000000; // grande para notar paralelismo (ajusta si va lento)
    double sum = 0.0;
    double step = 1.0 / (double)N;

    #pragma omp parallel for reduction(+:sum) schedule(static)
    for (long long i = 0; i < N; i++) {
        double x = (i + 0.5) * step;
        sum += 4.0 / (1.0 + x*x);
    }

    double pi = sum * step;
    printf("PI ~= %.12f\n", pi);
    printf("Threads used: %d\n", omp_get_max_threads());
    return 0;
}

